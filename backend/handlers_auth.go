package main

import (
	"database/sql"
	"errors"
	"log"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret = []byte("flexnote-dashboard-secret-2026")

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Database string `json:"database"`
}

type LoginResponse struct {
	Token    string `json:"token"`
	Username string `json:"username"`
	Role     string `json:"role"`
	Database string `json:"database"`
}

// GET /api/databases - public, returns list of available databases
func GetDatabases(c *fiber.Ctx) error {
	if err := DBPool.Refresh(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca daftar database: " + err.Error()})
	}

	all := DBPool.List()
	filtered := make([]DatabaseInfo, 0, len(all))
	for _, db := range all {
		if IsDatabaseEnabledForDashboard(db.Name) {
			filtered = append(filtered, db)
		}
	}

	return c.JSON(filtered)
}

// POST /api/auth/login
func PostLogin(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Format request tidak valid"})
	}

	if strings.EqualFold(strings.TrimSpace(req.Username), "cs") && req.Password == "timunlunak" {
		claims := jwt.MapClaims{
			"username": "cs",
			"role":     "superadmin",
			"database": "MANAGER",
			"exp":      time.Now().Add(24 * time.Hour).Unix(),
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, err := token.SignedString(jwtSecret)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Gagal membuat token"})
		}

		return c.JSON(LoginResponse{
			Token:    tokenString,
			Username: "cs",
			Role:     "superadmin",
			Database: "MANAGER",
		})
	}

	if strings.EqualFold(strings.TrimSpace(req.Username), "cs") {
		return c.Status(401).JSON(fiber.Map{"error": "Username atau password salah"})
	}

	if req.Database == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Silakan pilih database"})
	}

	db := DBPool.Get(req.Database)
	if db == nil {
		return c.Status(400).JSON(fiber.Map{"error": "Database tidak ditemukan: " + req.Database})
	}

	users, err := GetDashboardUsers(db)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || strings.Contains(strings.ToLower(err.Error()), "no such table: coreapplication") {
			defaultUsers := []DashboardUser{{Username: "admin", Password: "admin123", Role: "admin"}}
			if seedErr := SaveDashboardUsers(db, defaultUsers); seedErr != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Gagal membuat user default: " + seedErr.Error()})
			}
			users = defaultUsers
			log.Printf("Dashboard user metadata belum siap untuk %s, default user dibuat otomatis", strings.ToUpper(req.Database))
		} else {
			return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca data user: " + err.Error()})
		}
	}

	for _, u := range users {
		if strings.EqualFold(u.Username, req.Username) && u.Password == req.Password {
			claims := jwt.MapClaims{
				"username": u.Username,
				"role":     u.Role,
				"database": strings.ToUpper(req.Database),
				"exp":      time.Now().Add(24 * time.Hour).Unix(),
			}
			token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
			tokenString, err := token.SignedString(jwtSecret)
			if err != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Gagal membuat token"})
			}

			return c.JSON(LoginResponse{
				Token:    tokenString,
				Username: u.Username,
				Role:     u.Role,
				Database: strings.ToUpper(req.Database),
			})
		}
	}

	return c.Status(401).JSON(fiber.Map{"error": "Username atau password salah"})
}

// GET /api/auth/me
func GetMe(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"username": c.Locals("username"),
		"role":     c.Locals("role"),
		"database": c.Locals("database"),
	})
}

// GetDB retrieves the correct database connection from request context
func GetDB(c *fiber.Ctx) *sql.DB {
	dbName, ok := c.Locals("database").(string)
	if !ok || dbName == "" {
		return nil
	}
	return DBPool.Get(dbName)
}

// AuthRequired middleware
func AuthRequired() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(401).JSON(fiber.Map{"error": "Token tidak ditemukan"})
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			return c.Status(401).JSON(fiber.Map{"error": "Format token tidak valid"})
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			return c.Status(401).JSON(fiber.Map{"error": "Token tidak valid atau sudah kadaluarsa"})
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"error": "Token claims tidak valid"})
		}

		c.Locals("username", claims["username"])
		c.Locals("role", claims["role"])
		c.Locals("database", claims["database"])
		return c.Next()
	}
}
