package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
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

	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("cannot create database directory '%s': %v", dir, err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("cannot read database directory '%s': %v", dir, err)
	}

	count := 0
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(strings.ToLower(entry.Name()), ".db") {
			name := strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name()))
			dbPath := filepath.Join(dir, entry.Name())
			db, err := sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
			if err != nil {
				log.Printf("Warning: cannot open database '%s': %v", entry.Name(), err)
				continue
			}
			if err := db.Ping(); err != nil {
				log.Printf("Warning: cannot ping database '%s': %v", entry.Name(), err)
				continue
			}
			p.connections[strings.ToUpper(name)] = db
			count++
			log.Printf("  Database loaded: %s (%s)", strings.ToUpper(name), entry.Name())
		}
	}

	if count == 0 {
		log.Printf("Warning: no .db files found in '%s'", dir)
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
	return list
}

// ========== Auth Helpers ==========

type DashboardUser struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type DashboardUsersData struct {
	Users []DashboardUser `json:"users"`
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
	return usersData.Users, nil
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
