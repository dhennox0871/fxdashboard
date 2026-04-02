package main

import (
	"log"
	"os/exec"
	"strings"

	"github.com/gofiber/fiber/v2"
)

type CompanyInfoResponse struct {
	CompanyName string `json:"company_name"`
}

func GetCompanyInfo(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}
	q := `SELECT COALESCE(datachar1 || ' - ' || datachar2, 'Flexnote Default Company') as company_name
		FROM flexnotesetting WHERE UPPER(settingtypecode) = 'CUSTOMERINFO1' LIMIT 1`
	var res CompanyInfoResponse
	err := db.QueryRow(q).Scan(&res.CompanyName)
	if err != nil {
		log.Println("Error in GetCompanyInfo:", err)
		res.CompanyName = "Perusahaan Anda"
	}
	return c.JSON(res)
}

func PostSync(c *fiber.Ctx) error {
	dbName, ok := c.Locals("database").(string)
	if !ok || dbName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Database tidak terpilih"})
	}

	dbName = strings.ToLower(dbName)
	var script string
	switch dbName {
	case "oslank":
		script = "migrate_to_sqlite.py"
	case "sksmrt":
		script = "migrate_sksmrt.py"
	case "oslsrg":
		script = "migrate_oslsrg_server.py"
	default:
		return c.Status(400).JSON(fiber.Map{"error": "Skrip sinkronisasi tidak ditemukan untuk database ini"})
	}

	log.Printf("Starting sync for %s using %s", dbName, script)
	
	// Execute the python script
	cmd := exec.Command("python", script)
	// cmd.Dir = "." // current backend dir
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Sync failed: %v\nOutput: %s", err, string(output))
		return c.Status(500).JSON(fiber.Map{
			"error": "Gagal menjalankan sinkronisasi: " + err.Error(),
			"detail": string(output),
		})
	}

	log.Printf("Sync success for %s", dbName)
	
	// Re-initialize the pool to reload the DB? 
	// DBPool.Init(os.Getenv("DB_DIR")) // Optional, normally not needed if using the same file

	return c.JSON(fiber.Map{
		"message": "Sinkronisasi berhasil untuk " + dbName,
	})
}
