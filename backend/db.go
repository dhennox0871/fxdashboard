package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	_ "modernc.org/sqlite"
)

// DBPool manages multiple database connections
var DBPool = &DatabasePool{
	connections: make(map[string]*sql.DB),
}

type DatabasePool struct {
	mu          sync.RWMutex
	connections map[string]*sql.DB
	dbDir       string
}

type DatabaseInfo struct {
	Name     string `json:"name"`
	Filename string `json:"filename"`
}

// InitPool scans the database directory for .db files
func (p *DatabasePool) Init(dir string) error {
	p.dbDir = dir
	return p.reloadFromDisk()
}

// Refresh rescans DB_DIR and loads newly created SQLite files.
func (p *DatabasePool) Refresh() error {
	p.mu.RLock()
	dir := p.dbDir
	p.mu.RUnlock()
	if dir == "" {
		return fmt.Errorf("database pool not initialized")
	}
	return p.reloadFromDisk()
}

func (p *DatabasePool) DBDir() string {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.dbDir
}

func (p *DatabasePool) reloadFromDisk() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if err := os.MkdirAll(p.dbDir, 0755); err != nil {
		return fmt.Errorf("cannot create database directory '%s': %v", p.dbDir, err)
	}

	entries, err := os.ReadDir(p.dbDir)
	if err != nil {
		return fmt.Errorf("cannot read database directory '%s': %v", p.dbDir, err)
	}

	newConnections := make(map[string]*sql.DB)
	count := 0
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".db") {
			continue
		}

		name := strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name()))
		upperName := strings.ToUpper(name)
		if upperName == "MANAGER" {
			continue
		}

		if existing, ok := p.connections[upperName]; ok {
			newConnections[upperName] = existing
			count++
			continue
		}

		dbPath := filepath.Join(p.dbDir, entry.Name())
		db, err := sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
		if err != nil {
			log.Printf("Warning: cannot open database '%s': %v", entry.Name(), err)
			continue
		}
		if err := db.Ping(); err != nil {
			log.Printf("Warning: cannot ping database '%s': %v", entry.Name(), err)
			_ = db.Close()
			continue
		}

		newConnections[upperName] = db
		count++
		log.Printf("  Database loaded: %s (%s)", upperName, entry.Name())
	}

	for name, oldConn := range p.connections {
		if _, stillUsed := newConnections[name]; !stillUsed {
			_ = oldConn.Close()
		}
	}

	p.connections = newConnections

	if count == 0 {
		log.Printf("Warning: no .db files found in '%s'", p.dbDir)
		return nil
	}

	log.Printf("Total databases loaded: %d", count)
	return nil
}

// Get returns a database connection by name
func (p *DatabasePool) Get(name string) *sql.DB {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.connections[strings.ToUpper(name)]
}

// List returns all available database names
func (p *DatabasePool) List() []DatabaseInfo {
	p.mu.RLock()
	defer p.mu.RUnlock()
	var list []DatabaseInfo
	for name := range p.connections {
		list = append(list, DatabaseInfo{
			Name:     name,
			Filename: strings.ToLower(name) + ".db",
		})
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].Name < list[j].Name
	})
	return list
}

// ========== Auth Helpers ==========

type DashboardUser struct {
	Username      string   `json:"username"`
	Password      string   `json:"password"`
	Role          string   `json:"role"`
	IsMasterAdmin bool     `json:"is_masteradmin,omitempty"`
	MenuAccess    []string `json:"menu_access,omitempty"`
}

type DashboardUsersData struct {
	Users []DashboardUser `json:"users"`
}

var defaultDashboardMenus = []string{
	"daily",
	"annually",
	"bi-planning",
	"settings",
	"sync",
	"manage-users",
}

func cloneMenuAccess(menu []string) []string {
	out := make([]string, 0, len(menu))
	out = append(out, menu...)
	return out
}

func normalizeMenuAccess(menu []string) []string {
	if len(menu) == 0 {
		return []string{}
	}
	seen := map[string]struct{}{}
	out := make([]string, 0, len(menu))
	for _, m := range menu {
		mv := strings.TrimSpace(strings.ToLower(m))
		if mv == "" {
			continue
		}
		if _, ok := seen[mv]; ok {
			continue
		}
		seen[mv] = struct{}{}
		out = append(out, mv)
	}
	sort.Strings(out)
	return out
}

func normalizeDashboardUsers(users []DashboardUser) []DashboardUser {
	normalized := make([]DashboardUser, 0, len(users))
	for _, u := range users {
		nu := u
		nu.Username = strings.TrimSpace(nu.Username)
		if nu.Role == "" {
			nu.Role = "admin"
		}

		isDefaultMaster := strings.EqualFold(nu.Username, "admin") && nu.Password == "admin123"
		if isDefaultMaster {
			nu.IsMasterAdmin = true
		}

		if nu.IsMasterAdmin {
			nu.MenuAccess = cloneMenuAccess(defaultDashboardMenus)
		} else {
			// Backward compatibility: old users without menu config keep access to legacy menus.
			if len(nu.MenuAccess) == 0 {
				nu.MenuAccess = []string{"daily", "annually", "bi-planning", "settings", "sync", "manage-users"}
			}
			nu.MenuAccess = normalizeMenuAccess(nu.MenuAccess)
		}

		normalized = append(normalized, nu)
	}
	return normalized
}

func GetDashboardUsers(db *sql.DB) ([]DashboardUser, error) {
	var data string
	err := db.QueryRow("SELECT data FROM coreapplication WHERE flag = 88888 LIMIT 1").Scan(&data)
	if err != nil {
		return nil, err
	}

	var usersData DashboardUsersData
	if err := json.Unmarshal([]byte(data), &usersData); err != nil {
		return nil, err
	}
	return normalizeDashboardUsers(usersData.Users), nil
}

func SaveDashboardUsers(db *sql.DB, users []DashboardUser) error {
	usersData := DashboardUsersData{Users: normalizeDashboardUsers(users)}
	payload, err := json.Marshal(usersData)
	if err != nil {
		return err
	}

	// Ensure auth metadata table exists for databases created outside migration scripts.
	if _, err := db.Exec("CREATE TABLE IF NOT EXISTS coreapplication (coreapplicationid INTEGER PRIMARY KEY AUTOINCREMENT, flag INTEGER NOT NULL DEFAULT 0, data TEXT)"); err != nil {
		return err
	}
	if _, err := db.Exec("CREATE INDEX IF NOT EXISTS idx_coreapplication_flag ON coreapplication(flag)"); err != nil {
		return err
	}

	_, err = db.Exec("INSERT OR REPLACE INTO coreapplication (flag, data) VALUES (88888, ?)", string(payload))
	return err
}

func EnsureDashboardUsersForAllDatabases() {
	for _, info := range DBPool.List() {
		db := DBPool.Get(info.Name)
		if db == nil {
			continue
		}

		users, err := GetDashboardUsers(db)
		if err != nil {
			if err == sql.ErrNoRows || strings.Contains(strings.ToLower(err.Error()), "no such table: coreapplication") {
				defaultUsers := []DashboardUser{{Username: "admin", Password: "admin123", Role: "admin"}}
				if seedErr := SaveDashboardUsers(db, defaultUsers); seedErr != nil {
					log.Printf("Warning: gagal seed default user untuk %s: %v", info.Name, seedErr)
					continue
				}
				log.Printf("Default user admin diinisialisasi untuk database %s", info.Name)
				continue
			}

			log.Printf("Warning: gagal baca user dashboard untuk %s: %v", info.Name, err)
			continue
		}

		if saveErr := SaveDashboardUsers(db, users); saveErr != nil {
			log.Printf("Warning: gagal normalisasi user dashboard untuk %s: %v", info.Name, saveErr)
		}
	}
}

// ========== Response Structs ==========

type KPIResponse struct {
	TotalSales  float64 `json:"total_sales"`
	TotalOrders int     `json:"total_orders"`
}

type GroupResponse struct {
	ItemGroupCode string  `json:"itemgroupcode"`
	Description   string  `json:"description"`
	Total         float64 `json:"total"`
}

type CostCenterResponse struct {
	Description string  `json:"description"`
	Total       float64 `json:"total"`
}

type CashierResponse struct {
	CreateBy string  `json:"createby"`
	Total    float64 `json:"total"`
}

type GraphicResponse struct {
	Tgl    string  `json:"tgl"`
	Tunai  float64 `json:"tunai"`
	Kredit float64 `json:"kredit"`
}

type RecentTransaction struct {
	LogTransEntryText string  `json:"logtransentrytext"`
	SalesName         string  `json:"sales_name"`
	EntryDate         string  `json:"entrydate"`
	Total             float64 `json:"total"`
	TransTypeID       int     `json:"transtypeid"`
}
