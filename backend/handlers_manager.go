package main

import (
	"database/sql"
	"encoding/json"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// Middleware to ensure ONLY Super User can access
func SuperOnly(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)
	if role != "SUPERUSER" {
		return c.Status(403).JSON(fiber.Map{"error": "Akses ditolak. Hanya Super User yang diizinkan."})
	}
	return c.Next()
}

// GET /api/manager/connections
func GetManagerConnections(c *fiber.Ctx) error {
	list, err := DBPool.GetConnections()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(list)
}

// POST /api/manager/connections
func PostManagerConnection(c *fiber.Ctx) error {
	var conn ClientConnection
	if err := c.BodyParser(&conn); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Format data tidak valid"})
	}

	if conn.Name == "" || conn.Host == "" || conn.DBName == "" || conn.Username == "" || conn.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Semua field (Name, Host, DB Name, User, Pass) harus diisi"})
	}

	_, err := DBPool.managerDB.Exec(
		"INSERT INTO connections (name, host, db_name, username, password, driver) VALUES (?, ?, ?, ?, ?, ?)",
		strings.ToUpper(conn.Name), conn.Host, conn.DBName, conn.Username, conn.Password, conn.Driver,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan koneksi: " + err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Koneksi database berhasil ditambahkan"})
}

// PUT /api/manager/connections/:id
func UpdateManagerConnection(c *fiber.Ctx) error {
	id := c.Params("id")
	var conn ClientConnection
	if err := c.BodyParser(&conn); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Format data tidak valid"})
	}

	_, err := DBPool.managerDB.Exec(
		"UPDATE connections SET name = ?, host = ?, db_name = ?, username = ?, password = ?, driver = ? WHERE id = ?",
		strings.ToUpper(conn.Name), conn.Host, conn.DBName, conn.Username, conn.Password, conn.Driver, id,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal mengupdate koneksi: " + err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Koneksi database berhasil diperbarui"})
}

// DELETE /api/manager/connections/:id
func DeleteManagerConnection(c *fiber.Ctx) error {
	id := c.Params("id")
	_, err := DBPool.managerDB.Exec("DELETE FROM connections WHERE id = ?", id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menghapus koneksi: " + err.Error()})
	}
	return c.JSON(fiber.Map{"message": "Koneksi database berhasil dihapus"})
}

// ========== User Management ==========

// GET /api/manager/users
func GetManagerUsers(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(400).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}
	users, err := GetDashboardUsers(db)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(users)
}

// POST /api/manager/users
func PostManagerUser(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(400).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}

	var newUser DashboardUser
	if err := c.BodyParser(&newUser); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Format data tidak valid"})
	}

	users, err := GetDashboardUsers(db)
	if err != nil {
		users = []DashboardUser{} // Default if empty
	}

	// Check if exists
	for _, u := range users {
		if strings.EqualFold(u.Username, newUser.Username) {
			return c.Status(400).JSON(fiber.Map{"error": "Username sudah ada"})
		}
	}

	users = append(users, newUser)
	return SaveDashboardUsers(db, users)
}

// PUT /api/manager/users/:username (for Reset Password)
func UpdateManagerUser(c *fiber.Ctx) error {
	db := GetDB(c)
	username := c.Params("username")

	var updatedUser DashboardUser
	if err := c.BodyParser(&updatedUser); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Format data tidak valid"})
	}

	users, _ := GetDashboardUsers(db)
	found := false
	for i := range users {
		if strings.EqualFold(users[i].Username, username) {
			if updatedUser.Password != "" {
				users[i].Password = updatedUser.Password
			}
			if updatedUser.Role != "" {
				users[i].Role = updatedUser.Role
			}
			found = true
			break
		}
	}

	if !found {
		return c.Status(404).JSON(fiber.Map{"error": "User tidak ditemukan"})
	}

	return SaveDashboardUsers(db, users)
}

func SaveDashboardUsers(db *sql.DB, users []DashboardUser) error {
	data, _ := json.Marshal(DashboardUsersData{Users: users})
	_, err := db.Exec("UPDATE coreapplication SET data = ? WHERE flag = 88888", string(data))
	return err
}
