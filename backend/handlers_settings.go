package main

import (
	"fmt"
	"log"
	"os"
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

	// 1. Get credentials from manager.db
	conns, err := DBPool.GetConnections()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca konfigurasi: " + err.Error()})
	}

	var conn *ClientConnection
	for i := range conns {
		if strings.EqualFold(conns[i].Name, dbName) {
			conn = &conns[i]
			break
		}
	}

	// If not in manager.db, use ancient hardcoded defaults for backward compat? 
	// No, better to enforce manager.db or specific known ones
	if conn == nil {
		// Hardcoded fallbacks if needed, or error
		if strings.EqualFold(dbName, "SKSMRT") {
			conn = &ClientConnection{Host: "idtemp.flexnotesuite.com,18180", DBName: "sksmrt", Username: "fxt", Password: "r3startsaja"}
		} else if strings.EqualFold(dbName, "OSLANK") || strings.EqualFold(dbName, "OSLSRG") || strings.EqualFold(dbName, "OSLKEN") {
			conn = &ClientConnection{Host: "oslsrg.flexnotesuite.com,18180", DBName: strings.ToLower(dbName), Username: "dhen", Password: "abcMulyosari"}
		} else {
			return c.Status(400).JSON(fiber.Map{"error": "Kredensial database tidak ditemukan di manager.db. Silakan tambahkan koneksi di Database Manager."})
		}
	}

	log.Printf("Starting unified sync for %s", dbName)
	
	// 2. Execute sync_engine.py
	args := []string{
		"sync_engine.py",
		"--host", conn.Host,
		"--db", conn.DBName,
		"--user", conn.Username,
		"--password", conn.Password,
	}
	if conn.Driver != "" {
		args = append(args, "--driver", conn.Driver)
	}

	cmd := exec.Command("python3", args...)
	cmd.Dir = "."
	cmd.Env = append(os.Environ(), "DB_DIR="+os.Getenv("DB_DIR"))
	
	output, err := cmd.CombinedOutput()
	outputStr := string(output)
	
	if err != nil {
		log.Printf("Sync failed for %s: %v\nOutput: %s", dbName, err, outputStr)
		return c.Status(500).JSON(fiber.Map{
			"error": fmt.Sprintf("Gagal sinkronisasi: %v | %s", err, outputStr),
		})
	}

	// 3. Reload DBPool to detect the potentially new/updated .db file
	DBPool.Reload()

	return c.JSON(fiber.Map{
		"message": "Sinkronisasi berhasil untuk " + dbName,
	})
}
