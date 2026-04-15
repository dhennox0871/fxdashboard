package main

import (
	"database/sql"
	"errors"
	"sort"
	"strings"

	"github.com/gofiber/fiber/v2"
)

type DashboardUserPublic struct {
	Username      string   `json:"username"`
	Role          string   `json:"role"`
	IsMasterAdmin bool     `json:"is_masteradmin"`
	MenuAccess    []string `json:"menu_access"`
}

type ChangeOwnPasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

type CreateUserRequest struct {
	Username   string   `json:"username"`
	Password   string   `json:"password"`
	Role       string   `json:"role"`
	MenuAccess []string `json:"menu_access"`
}

type ResetPasswordRequest struct {
	NewPassword string `json:"new_password"`
}

type UpdateMenuRequest struct {
	MenuAccess []string `json:"menu_access"`
}

func loadDashboardUsersWithFallback(db *sql.DB) ([]DashboardUser, error) {
	users, err := GetDashboardUsers(db)
	if err == nil {
		return users, nil
	}

	if errors.Is(err, sql.ErrNoRows) || strings.Contains(strings.ToLower(err.Error()), "no such table: coreapplication") {
		defaultUsers := []DashboardUser{{Username: "admin", Password: "admin123", Role: "admin"}}
		if seedErr := SaveDashboardUsers(db, defaultUsers); seedErr != nil {
			return nil, seedErr
		}
		return GetDashboardUsers(db)
	}

	return nil, err
}

func isSuperAdmin(c *fiber.Ctx) bool {
	role, _ := c.Locals("role").(string)
	return strings.EqualFold(strings.TrimSpace(role), "superadmin")
}

func resolveUsersDB(c *fiber.Ctx) (*sql.DB, string, error) {
	if isSuperAdmin(c) {
		target := strings.ToUpper(strings.TrimSpace(c.Query("database", "")))
		if target == "" {
			return nil, "", errors.New("parameter database wajib diisi untuk superadmin")
		}
		db := DBPool.Get(target)
		if db == nil {
			return nil, "", errors.New("database tidak ditemukan: " + target)
		}
		return db, target, nil
	}

	db := GetDB(c)
	if db == nil {
		return nil, "", errors.New("database tidak tersedia untuk akun ini")
	}
	dbName, _ := c.Locals("database").(string)
	return db, strings.ToUpper(strings.TrimSpace(dbName)), nil
}

var allowedMenuSet = map[string]struct{}{
	"daily":        {},
	"annually":     {},
	"bi-planning":  {},
	"settings":     {},
	"sync":         {},
	"manage-users": {},
}

func GetManageUserDatabases(c *fiber.Ctx) error {
	if !isSuperAdmin(c) {
		dbName, _ := c.Locals("database").(string)
		return c.JSON(fiber.Map{"rows": []DatabaseInfo{{Name: strings.ToUpper(dbName), Filename: strings.ToLower(dbName) + ".db"}}})
	}

	if err := DBPool.Refresh(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca daftar database: " + err.Error()})
	}
	return c.JSON(fiber.Map{"rows": DBPool.List()})
}

func toPublicUser(u DashboardUser) DashboardUserPublic {
	return DashboardUserPublic{
		Username:      u.Username,
		Role:          u.Role,
		IsMasterAdmin: u.IsMasterAdmin,
		MenuAccess:    cloneMenuAccess(u.MenuAccess),
	}
}

func findUserIndex(users []DashboardUser, username string) int {
	for i, u := range users {
		if strings.EqualFold(strings.TrimSpace(u.Username), strings.TrimSpace(username)) {
			return i
		}
	}
	return -1
}

func parseMenuAccess(input []string, isMaster bool) ([]string, error) {
	if isMaster {
		return cloneMenuAccess(defaultDashboardMenus), nil
	}
	out := make([]string, 0, len(input))
	seen := map[string]struct{}{}
	for _, m := range input {
		mv := strings.TrimSpace(strings.ToLower(m))
		if mv == "" {
			continue
		}
		if _, ok := allowedMenuSet[mv]; !ok {
			return nil, errors.New("menu tidak valid: " + mv)
		}
		if _, ok := seen[mv]; ok {
			continue
		}
		seen[mv] = struct{}{}
		out = append(out, mv)
	}
	sort.Strings(out)
	return out, nil
}

func getCurrentUserFromDB(c *fiber.Ctx, users []DashboardUser) (*DashboardUser, int, error) {
	username, _ := c.Locals("username").(string)
	idx := findUserIndex(users, username)
	if idx < 0 {
		return nil, -1, errors.New("user tidak ditemukan")
	}
	return &users[idx], idx, nil
}

func GetManageUsers(c *fiber.Ctx) error {
	db, dbName, err := resolveUsersDB(c)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	users, err := GetDashboardUsers(db)
	if err != nil {
		users, err = loadDashboardUsersWithFallback(db)
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca user: " + err.Error()})
	}

	if isSuperAdmin(c) {
		rows := make([]DashboardUserPublic, 0, len(users))
		for _, u := range users {
			rows = append(rows, toPublicUser(u))
		}
		return c.JSON(fiber.Map{
			"database":   dbName,
			"users":      rows,
			"self":       fiber.Map{"username": c.Locals("username"), "role": c.Locals("role"), "is_masteradmin": true},
			"can_manage": true,
		})
	}

	current, _, err := getCurrentUserFromDB(c, users)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "User login tidak terdaftar"})
	}

	if current.IsMasterAdmin {
		rows := make([]DashboardUserPublic, 0, len(users))
		for _, u := range users {
			rows = append(rows, toPublicUser(u))
		}
		return c.JSON(fiber.Map{"users": rows, "self": toPublicUser(*current), "can_manage": true})
	}

	return c.JSON(fiber.Map{"users": []DashboardUserPublic{toPublicUser(*current)}, "self": toPublicUser(*current), "can_manage": false})
}

func CreateManageUser(c *fiber.Ctx) error {
	db, _, err := resolveUsersDB(c)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	var req CreateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Format request tidak valid"})
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Role = strings.ToLower(strings.TrimSpace(req.Role))
	if req.Role == "" {
		req.Role = "admin"
	}
	if req.Username == "" || req.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Username dan password wajib diisi"})
	}

	users, err := loadDashboardUsersWithFallback(db)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca user: " + err.Error()})
	}

	if !isSuperAdmin(c) {
		current, _, curErr := getCurrentUserFromDB(c, users)
		if curErr != nil || !current.IsMasterAdmin {
			return c.Status(403).JSON(fiber.Map{"error": "Hanya masteradmin yang boleh menambah user"})
		}
	}

	if findUserIndex(users, req.Username) >= 0 {
		return c.Status(409).JSON(fiber.Map{"error": "Username sudah digunakan"})
	}

	menuAccess, err := parseMenuAccess(req.MenuAccess, false)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	users = append(users, DashboardUser{
		Username:   req.Username,
		Password:   req.Password,
		Role:       req.Role,
		MenuAccess: menuAccess,
	})
	if err := SaveDashboardUsers(db, users); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan user: " + err.Error()})
	}
	return c.JSON(fiber.Map{"message": "User berhasil ditambahkan"})
}

func ResetManageUserPassword(c *fiber.Ctx) error {
	db, _, err := resolveUsersDB(c)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	target := strings.TrimSpace(c.Params("username"))
	if target == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Username target tidak valid"})
	}

	var req ResetPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Format request tidak valid"})
	}
	if strings.TrimSpace(req.NewPassword) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Password baru wajib diisi"})
	}

	users, err := loadDashboardUsersWithFallback(db)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca user: " + err.Error()})
	}

	if !isSuperAdmin(c) {
		current, _, curErr := getCurrentUserFromDB(c, users)
		if curErr != nil || !current.IsMasterAdmin {
			return c.Status(403).JSON(fiber.Map{"error": "Hanya masteradmin yang boleh reset password user"})
		}
	}

	targetIdx := findUserIndex(users, target)
	if targetIdx < 0 {
		return c.Status(404).JSON(fiber.Map{"error": "User tidak ditemukan"})
	}
	users[targetIdx].Password = req.NewPassword

	if err := SaveDashboardUsers(db, users); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan password baru: " + err.Error()})
	}
	return c.JSON(fiber.Map{"message": "Password user berhasil direset"})
}

func DeleteManageUser(c *fiber.Ctx) error {
	db, _, err := resolveUsersDB(c)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	target := strings.TrimSpace(c.Params("username"))
	if target == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Username target tidak valid"})
	}

	users, err := loadDashboardUsersWithFallback(db)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca user: " + err.Error()})
	}

	if !isSuperAdmin(c) {
		current, _, curErr := getCurrentUserFromDB(c, users)
		if curErr != nil || !current.IsMasterAdmin {
			return c.Status(403).JSON(fiber.Map{"error": "Hanya masteradmin yang boleh menghapus user"})
		}
	}

	targetIdx := findUserIndex(users, target)
	if targetIdx < 0 {
		return c.Status(404).JSON(fiber.Map{"error": "User tidak ditemukan"})
	}
	if users[targetIdx].IsMasterAdmin {
		return c.Status(400).JSON(fiber.Map{"error": "Masteradmin tidak boleh dihapus"})
	}

	username, _ := c.Locals("username").(string)
	if !isSuperAdmin(c) && strings.EqualFold(username, users[targetIdx].Username) {
		return c.Status(400).JSON(fiber.Map{"error": "Tidak bisa menghapus akun sendiri"})
	}

	users = append(users[:targetIdx], users[targetIdx+1:]...)
	if err := SaveDashboardUsers(db, users); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menghapus user: " + err.Error()})
	}
	return c.JSON(fiber.Map{"message": "User berhasil dihapus"})
}

func UpdateManageUserMenus(c *fiber.Ctx) error {
	db, _, err := resolveUsersDB(c)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	target := strings.TrimSpace(c.Params("username"))
	if target == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Username target tidak valid"})
	}

	var req UpdateMenuRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Format request tidak valid"})
	}

	users, err := loadDashboardUsersWithFallback(db)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca user: " + err.Error()})
	}

	if !isSuperAdmin(c) {
		current, _, curErr := getCurrentUserFromDB(c, users)
		if curErr != nil || !current.IsMasterAdmin {
			return c.Status(403).JSON(fiber.Map{"error": "Hanya masteradmin yang boleh mengatur menu user"})
		}
	}

	targetIdx := findUserIndex(users, target)
	if targetIdx < 0 {
		return c.Status(404).JSON(fiber.Map{"error": "User tidak ditemukan"})
	}
	if users[targetIdx].IsMasterAdmin {
		return c.Status(400).JSON(fiber.Map{"error": "Menu masteradmin tidak bisa dibatasi"})
	}

	menuAccess, err := parseMenuAccess(req.MenuAccess, false)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	users[targetIdx].MenuAccess = menuAccess

	if err := SaveDashboardUsers(db, users); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan pengaturan menu: " + err.Error()})
	}
	return c.JSON(fiber.Map{"message": "Menu user berhasil diperbarui"})
}

func ChangeOwnPassword(c *fiber.Ctx) error {
	if isSuperAdmin(c) {
		return c.Status(400).JSON(fiber.Map{"error": "Password akun superadmin dikelola terpisah"})
	}

	db := GetDB(c)
	if db == nil {
		return c.Status(400).JSON(fiber.Map{"error": "Database tidak tersedia untuk akun ini"})
	}

	var req ChangeOwnPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Format request tidak valid"})
	}
	if strings.TrimSpace(req.OldPassword) == "" || strings.TrimSpace(req.NewPassword) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Password lama dan baru wajib diisi"})
	}

	users, err := loadDashboardUsersWithFallback(db)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca user: " + err.Error()})
	}
	current, currentIdx, err := getCurrentUserFromDB(c, users)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "User login tidak terdaftar"})
	}

	if current.Password != req.OldPassword {
		return c.Status(400).JSON(fiber.Map{"error": "Password lama tidak sesuai"})
	}
	users[currentIdx].Password = req.NewPassword

	if err := SaveDashboardUsers(db, users); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan password baru: " + err.Error()})
	}
	return c.JSON(fiber.Map{"message": "Password berhasil diubah"})
}
