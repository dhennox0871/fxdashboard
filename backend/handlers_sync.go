package main

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// ClearDatabase deletes the SQLite database file for the current database context
func ClearDatabase(c *fiber.Ctx) error {
	dbName, ok := c.Locals("database").(string)
	if !ok || dbName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Database name is required (context missing)"})
	}

	dbDir := os.Getenv("DB_DIR")
	if dbDir == "" {
		dbDir = "./data"
	}

	filename := strings.ToLower(dbName) + ".db"
	dbPath := filepath.Join(dbDir, filename)

	// 1. Close existing connection if any
	db := DBPool.Get(dbName)
	if db != nil {
		log.Printf("Closing connection to database %s before deletion", dbName)
		db.Close()
		
		// Remove from pool
		DBPool.mu.Lock()
		delete(DBPool.connections, strings.ToUpper(dbName))
		DBPool.mu.Unlock()
	}

	// 2. Check if file exists
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		return c.JSON(fiber.Map{
			"message": "Database file already cleared (not found). Ready for fresh sync.",
		})
	}

	// 3. Delete the file
	err := os.Remove(dbPath)
	if err != nil {
		log.Printf("Error deleting database file %s: %v", dbPath, err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete database file: " + err.Error()})
	}

	log.Printf("Database %s cleared successfully by user request", dbName)

	return c.JSON(fiber.Map{
		"message": "Data berhasil dihapus. Anda sekarang dapat menekan tombol Sinkronisasi untuk mengunduh ulang seluruh data.",
	})
}
