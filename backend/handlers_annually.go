package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
)

func getYearParam(c *fiber.Ctx) string {
	return c.Query("year", "2026")
}

func GetAnnuallyKPI(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}
	year := getYearParam(c)
	q := `SELECT COALESCE(SUM(ABS(ltl.netvalue + ltl.pajakvalue)),0), COUNT(DISTINCT lt.logtransid)
		FROM logtrans lt JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
		WHERE strftime('%Y', lt.entrydate) = ? AND lt.transtypeid IN (10, 18)`
	var res KPIResponse
	err := db.QueryRow(q, year).Scan(&res.TotalSales, &res.TotalOrders)
	if err != nil {
		log.Println("Error in GetAnnuallyKPI:", err)
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(res)
}

func GetAnnuallyChart(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}
	year := getYearParam(c)
	q := `SELECT CAST(strftime('%m', lt.entrydate) AS INTEGER) as bln,
		COALESCE(SUM(ABS(ltl.netvalue + ltl.pajakvalue)), 0) as total
		FROM logtrans lt JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
		WHERE strftime('%Y', lt.entrydate) = ? AND lt.transtypeid IN (10, 18)
		GROUP BY CAST(strftime('%m', lt.entrydate) AS INTEGER) ORDER BY bln ASC`
	rows, err := db.Query(q, year)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()
	type MonthlyResponse struct {
		Bulan int     `json:"bulan"`
		Total float64 `json:"total"`
	}
	var result []MonthlyResponse
	for rows.Next() {
		var item MonthlyResponse
		if err := rows.Scan(&item.Bulan, &item.Total); err == nil {
			result = append(result, item)
		}
	}
	return c.JSON(result)
}

func GetAnnuallyCashier(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}
	year := getYearParam(c)
	q := `SELECT createby, COALESCE(SUM(ABS(logtransline.netvalue + logtransline.pajakvalue)), 0) as total
		FROM logtrans JOIN logtransline ON logtrans.logtransid = logtransline.logtransid
		WHERE strftime('%Y', logtrans.entrydate) = ? AND logtrans.transtypeid IN (10, 18)
		GROUP BY createby ORDER BY total DESC`
	rows, err := db.Query(q, year)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()
	var result []CashierResponse
	for rows.Next() {
		var item CashierResponse
		if err := rows.Scan(&item.CreateBy, &item.Total); err == nil {
			result = append(result, item)
		}
	}
	return c.JSON(result)
}
