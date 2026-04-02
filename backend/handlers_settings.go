package main

import (
	"log"

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
