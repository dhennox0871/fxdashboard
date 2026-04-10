package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

type DatabaseSource struct {
	Name     string `json:"name"`
	Host     string `json:"host"`
	Database string `json:"database"`
	Username string `json:"username"`
	Password string `json:"password"`
	Script   string `json:"script"`
	Mode     string `json:"mode"`
	Enabled  bool   `json:"enabled"`
}

type DatabaseManagementItem struct {
	Name      string         `json:"name"`
	Filename  string         `json:"filename"`
	HasSQLite bool           `json:"has_sqlite"`
	Running   bool           `json:"running"`
	LastSync  string         `json:"last_sync"`
	Source    DatabaseSource `json:"source"`
}

type dbSourceFile struct {
	Sources []DatabaseSource `json:"sources"`
}

type dbSourceFileRaw struct {
	Sources []struct {
		Name     string `json:"name"`
		Host     string `json:"host"`
		Database string `json:"database"`
		Username string `json:"username"`
		Password string `json:"password"`
		Script   string `json:"script"`
		Mode     string `json:"mode"`
		Enabled  *bool  `json:"enabled"`
	} `json:"sources"`
}

type upsertDatabaseSourceRequest struct {
	Name     string `json:"name"`
	Host     string `json:"host"`
	Database string `json:"database"`
	Username string `json:"username"`
	Password string `json:"password"`
	Script   string `json:"script"`
	Mode     string `json:"mode"`
	Enabled  *bool  `json:"enabled"`
}

type databaseStatusRequest struct {
	Enabled bool `json:"enabled"`
}

func normalizeDBName(name string) string {
	return strings.ToUpper(strings.TrimSpace(name))
}

func ensureManagementAccess(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)
	if !strings.EqualFold(strings.TrimSpace(role), "superadmin") {
		return c.Status(403).JSON(fiber.Map{"error": "Akses ditolak: hanya akun management"})
	}
	return nil
}

func defaultDatabaseSource(name string) DatabaseSource {
	upper := normalizeDBName(name)

	return DatabaseSource{
		Name:     upper,
		Host:     "",
		Database: strings.ToLower(upper),
		Username: "",
		Password: "",
		Script:   "migrate_base.py",
		Mode:     "incremental",
		Enabled:  true,
	}
}

func knownDefaultDBNames() []string {
	return []string{"SKSMRT", "OSLSRG", "OSLANK", "OSLKEN"}
}

func dbSourceConfigPath() (string, error) {
	dbDir := DBPool.DBDir()
	if dbDir == "" {
		return "", fmt.Errorf("DB_DIR belum diinisialisasi")
	}
	return filepath.Join(dbDir, "db_sources.json"), nil
}

func loadDatabaseSources() (map[string]DatabaseSource, error) {
	path, err := dbSourceConfigPath()
	if err != nil {
		return nil, err
	}

	result := map[string]DatabaseSource{}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return result, nil
	}

	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var wrapper dbSourceFileRaw
	if err := json.Unmarshal(b, &wrapper); err != nil {
		return nil, err
	}

	for _, src := range wrapper.Sources {
		name := normalizeDBName(src.Name)
		if name == "" {
			continue
		}
		enabled := true
		if src.Enabled != nil {
			enabled = *src.Enabled
		}
		parsed := DatabaseSource{
			Name:     name,
			Host:     src.Host,
			Database: src.Database,
			Username: src.Username,
			Password: src.Password,
			Script:   src.Script,
			Mode:     src.Mode,
			Enabled:  enabled,
		}
		if parsed.Database == "" {
			parsed.Database = strings.ToLower(parsed.Name)
		}
		result[parsed.Name] = parsed
	}

	return result, nil
}

func saveDatabaseSources(sources map[string]DatabaseSource) error {
	path, err := dbSourceConfigPath()
	if err != nil {
		return err
	}

	keys := make([]string, 0, len(sources))
	for name := range sources {
		keys = append(keys, name)
	}
	sort.Strings(keys)

	wrapper := dbSourceFile{Sources: make([]DatabaseSource, 0, len(keys))}
	for _, name := range keys {
		src := sources[name]
		src.Name = normalizeDBName(src.Name)
		if src.Database == "" {
			src.Database = strings.ToLower(src.Name)
		}
		if src.Name == "" {
			continue
		}
		wrapper.Sources = append(wrapper.Sources, src)
	}

	payload, err := json.MarshalIndent(wrapper, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, payload, 0644)
}

func mergeWithKnownDatabases(sources map[string]DatabaseSource) {
	for _, base := range knownDefaultDBNames() {
		if _, ok := sources[base]; !ok {
			sources[base] = defaultDatabaseSource(base)
		}
	}
	for _, db := range DBPool.List() {
		if _, ok := sources[db.Name]; !ok {
			sources[db.Name] = defaultDatabaseSource(db.Name)
		}
	}
}

func GetDatabaseManagementList(c *fiber.Ctx) error {
	if err := ensureManagementAccess(c); err != nil {
		return err
	}

	if err := DBPool.Refresh(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca SQLite: " + err.Error()})
	}

	sources, err := loadDatabaseSources()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca konfigurasi database: " + err.Error()})
	}
	mergeWithKnownDatabases(sources)

	existing := map[string]bool{}
	for _, db := range DBPool.List() {
		existing[db.Name] = true
	}

	names := make([]string, 0, len(sources))
	for name := range sources {
		names = append(names, name)
	}
	sort.Strings(names)

	items := make([]DatabaseManagementItem, 0, len(names))
	for _, name := range names {
		src := sources[name]
		state := getSyncProgress(strings.ToLower(name))
		running := false
		if state != nil {
			running = state.Running
		}
		lastSync := getDatabaseLastSync(name)
		if lastSync == "" && state != nil && !state.FinishedAt.IsZero() {
			lastSync = state.FinishedAt.Format("2006-01-02 15:04:05")
		}
		items = append(items, DatabaseManagementItem{
			Name:      name,
			Filename:  strings.ToLower(name) + ".db",
			HasSQLite: existing[name],
			Running:   running,
			LastSync:  lastSync,
			Source:    src,
		})
	}

	if err := saveDatabaseSources(sources); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan konfigurasi database: " + err.Error()})
	}

	return c.JSON(fiber.Map{"items": items})
}

func getDatabaseLastSync(name string) string {
	db := DBPool.Get(name)
	if db == nil {
		return ""
	}

	var value string
	err := db.QueryRow("SELECT data FROM coreapplication WHERE flag = 99999 LIMIT 1").Scan(&value)
	if err == nil {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}

	var dt string
	err = db.QueryRow("SELECT createdate FROM coreapplication WHERE flag = 99999 LIMIT 1").Scan(&dt)
	if err == nil {
		trimmed := strings.TrimSpace(dt)
		if trimmed != "" {
			return trimmed
		}
	}

	var unixValue int64
	err = db.QueryRow("SELECT CAST(data AS INTEGER) FROM coreapplication WHERE flag = 99999 LIMIT 1").Scan(&unixValue)
	if err == nil && unixValue > 0 {
		return time.Unix(unixValue, 0).Format("2006-01-02 15:04:05")
	}

	return ""
}

func UpsertDatabaseSource(c *fiber.Ctx) error {
	if err := ensureManagementAccess(c); err != nil {
		return err
	}

	var req upsertDatabaseSourceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Format request tidak valid"})
	}

	req.Name = normalizeDBName(req.Name)
	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Nama database wajib diisi"})
	}
	if req.Host == "" || req.Database == "" || req.Username == "" || req.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Host, database, user, dan password wajib diisi"})
	}

	req.Script = "migrate_base.py"
	if req.Mode == "" {
		req.Mode = defaultDatabaseSource(req.Name).Mode
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	source := DatabaseSource{
		Name:     req.Name,
		Host:     req.Host,
		Database: req.Database,
		Username: req.Username,
		Password: req.Password,
		Script:   req.Script,
		Mode:     req.Mode,
		Enabled:  enabled,
	}

	sources, err := loadDatabaseSources()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca konfigurasi database: " + err.Error()})
	}

	sources[source.Name] = source
	if err := saveDatabaseSources(sources); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan konfigurasi database: " + err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Konfigurasi database tersimpan", "source": source})
}

func SetDatabaseStatus(c *fiber.Ctx) error {
	if err := ensureManagementAccess(c); err != nil {
		return err
	}

	name := normalizeDBName(c.Params("name"))
	if name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Nama database tidak valid"})
	}

	var req databaseStatusRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Format request tidak valid"})
	}

	sources, err := loadDatabaseSources()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca konfigurasi database: " + err.Error()})
	}

	source, ok := sources[name]
	if !ok {
		source = defaultDatabaseSource(name)
	}
	source.Enabled = req.Enabled
	sources[name] = source

	if err := saveDatabaseSources(sources); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan status database: " + err.Error()})
	}

	statusText := "OFF"
	if source.Enabled {
		statusText = "ON"
	}

	return c.JSON(fiber.Map{
		"message": "Status database " + name + " diubah ke " + statusText,
		"source":  source,
	})
}

func DeleteDatabaseSource(c *fiber.Ctx) error {
	if err := ensureManagementAccess(c); err != nil {
		return err
	}

	name := normalizeDBName(c.Params("name"))
	if name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Nama database tidak valid"})
	}

	sources, err := loadDatabaseSources()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca konfigurasi database: " + err.Error()})
	}

	if _, ok := sources[name]; !ok {
		return c.Status(404).JSON(fiber.Map{"error": "Konfigurasi database tidak ditemukan"})
	}

	delete(sources, name)
	if err := saveDatabaseSources(sources); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menghapus konfigurasi database: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":  "Konfigurasi database " + name + " berhasil dihapus",
		"database": name,
	})
}

func IsDatabaseEnabledForDashboard(name string) bool {
	sources, err := loadDatabaseSources()
	if err != nil {
		return true
	}

	upper := normalizeDBName(name)
	source, ok := sources[upper]
	if !ok {
		return true
	}

	return source.Enabled
}

func resolveSyncScriptAndArgs(name string, source DatabaseSource) (string, []string) {
	dbNameLower := strings.ToLower(name)
	script := "migrate_base.py"
	mode := strings.ToLower(strings.TrimSpace(source.Mode))
	args := []string{dbNameLower}
	if mode == "full" {
		args = append(args, "--full")
	}
	return script, args
}

func PostSyncDatabaseByName(c *fiber.Ctx) error {
	if err := ensureManagementAccess(c); err != nil {
		return err
	}

	name := normalizeDBName(c.Params("name"))
	if name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Nama database tidak valid"})
	}

	sources, err := loadDatabaseSources()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca konfigurasi database: " + err.Error()})
	}

	source, ok := sources[name]
	if !ok {
		source = defaultDatabaseSource(name)
	}

	targetDatabase := strings.TrimSpace(source.Database)
	if targetDatabase == "" {
		targetDatabase = strings.ToLower(name)
	}

	env := map[string]string{
		"DB_DIR": DBPool.DBDir(),
	}
	if source.Host != "" {
		env["DB_SOURCE_HOST"] = source.Host
	}
	env["DB_SOURCE_DB"] = targetDatabase
	if source.Username != "" {
		env["DB_SOURCE_USER"] = source.Username
	}
	if source.Password != "" {
		env["DB_SOURCE_PASS"] = source.Password
	}

	script, args := resolveSyncScriptAndArgs(name, source)
	if err := startSyncJob(strings.ToLower(name), script, args, env); err != nil {
		return c.Status(409).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":  "Sinkronisasi dimulai untuk " + name,
		"running":  true,
		"database": name,
	})
}
