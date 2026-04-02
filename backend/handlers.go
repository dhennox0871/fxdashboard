package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
)

func getDateRange(c *fiber.Ctx) (string, string) {
	startDate := c.Query("startDate", "19700101")
	endDate := c.Query("endDate", "20991231")
	startFmt := startDate[:4] + "-" + startDate[4:6] + "-" + startDate[6:8] + " 00:00:00"
	endFmt := endDate[:4] + "-" + endDate[4:6] + "-" + endDate[6:8] + " 23:59:59"
	return startFmt, endFmt
}

func GetDailyKPI(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}
	startStr, endStr := getDateRange(c)
	q := `SELECT COALESCE(SUM(ABS(ltl.netvalue + ltl.pajakvalue)), 0), COUNT(DISTINCT lt.logtransid)
		FROM logtrans lt JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
		WHERE lt.entrydate BETWEEN ? AND ? AND lt.transtypeid IN (10, 18)`
	var res KPIResponse
	err := db.QueryRow(q, startStr, endStr).Scan(&res.TotalSales, &res.TotalOrders)
	if err != nil {
		log.Println("Error in GetDailyKPI:", err)
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(res)
}

func GetDailyGroup(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}
	startStr, endStr := getDateRange(c)
	q := `SELECT masteritemgroup.itemgroupcode, masteritemgroup.description, 
		-SUM(logtransline.netvalue + logtransline.pajakvalue) as total
		FROM logtrans JOIN logtransline ON logtrans.logtransid = logtransline.logtransid
		JOIN masteritem ON logtransline.itemid = masteritem.itemid
		JOIN masteritemgroup ON masteritem.itemgroupid = masteritemgroup.itemgroupid
		WHERE logtrans.entrydate BETWEEN ? AND ? AND logtrans.transtypeid IN (10, 18)
		AND (masteritemgroup.description NOT LIKE '%bahan%' AND masteritemgroup.itemgroupcode <> 'UMUM')
		GROUP BY masteritemgroup.itemgroupcode, masteritemgroup.description
		HAVING -SUM(logtransline.netvalue + logtransline.pajakvalue) > 0
		ORDER BY total DESC`
	rows, err := db.Query(q, startStr, endStr)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()
	var result []GroupResponse
	for rows.Next() {
		var item GroupResponse
		if err := rows.Scan(&item.ItemGroupCode, &item.Description, &item.Total); err == nil {
			result = append(result, item)
		}
	}
	return c.JSON(result)
}

func GetDailyCostcenter(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}
	startStr, endStr := getDateRange(c)
	q := `SELECT mastercostcenter.description, COALESCE(SUM(ABS(logtransline.netvalue + logtransline.pajakvalue)), 0) as total
		FROM logtrans JOIN logtransline ON logtrans.logtransid = logtransline.logtransid
		JOIN mastercostcenter ON logtrans.costcenterid = mastercostcenter.costcenterid
		WHERE logtrans.entrydate BETWEEN ? AND ? AND logtrans.transtypeid IN (10, 18)
		GROUP BY mastercostcenter.description ORDER BY total DESC`
	rows, err := db.Query(q, startStr, endStr)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()
	var result []CostCenterResponse
	for rows.Next() {
		var item CostCenterResponse
		if err := rows.Scan(&item.Description, &item.Total); err == nil {
			result = append(result, item)
		}
	}
	return c.JSON(result)
}

func GetDailyChart(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}
	startStr, endStr := getDateRange(c)
	q := `SELECT DATE(lt.entrydate) as tgl,
		COALESCE(SUM(CASE WHEN lt.transtypeid = 18 THEN ABS(ltl.netvalue + ltl.pajakvalue) ELSE 0 END), 0) as tunai,
		COALESCE(SUM(CASE WHEN lt.transtypeid = 10 THEN ABS(ltl.netvalue + ltl.pajakvalue) ELSE 0 END), 0) as kredit
		FROM logtrans lt JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
		WHERE lt.entrydate BETWEEN ? AND ? AND lt.transtypeid IN (10, 18)
		GROUP BY DATE(lt.entrydate) ORDER BY tgl ASC`
	rows, err := db.Query(q, startStr, endStr)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()
	var result []GraphicResponse
	for rows.Next() {
		var item GraphicResponse
		if err := rows.Scan(&item.Tgl, &item.Tunai, &item.Kredit); err == nil {
			result = append(result, item)
		}
	}
	return c.JSON(result)
}

func GetDailyCashier(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}
	startStr, endStr := getDateRange(c)
	q := `SELECT createby, COALESCE(SUM(ABS(logtransline.netvalue + logtransline.pajakvalue)), 0) as total
		FROM logtrans JOIN logtransline ON logtrans.logtransid = logtransline.logtransid
		WHERE logtrans.entrydate BETWEEN ? AND ? AND logtrans.transtypeid IN (10, 18)
		GROUP BY createby ORDER BY total DESC`
	rows, err := db.Query(q, startStr, endStr)
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

func GetDailyRecent(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}
	startStr, endStr := getDateRange(c)
	q := `SELECT lt.logtransentrytext, r.name, strftime('%Y-%m-%d %H:%M', lt.entrydate),
		COALESCE(SUM(ABS(ltl.netvalue + ltl.pajakvalue)), 0), lt.transtypeid
		FROM logtrans lt JOIN masterrepresentative r ON lt.representativeid = r.representativeid
		JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
		WHERE lt.entrydate BETWEEN ? AND ? AND lt.transtypeid IN (10, 18)
		GROUP BY lt.logtransentrytext, r.name, lt.entrydate, lt.transtypeid
		ORDER BY lt.entrydate DESC LIMIT 10`
	rows, err := db.Query(q, startStr, endStr)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()
	var result []RecentTransaction
	for rows.Next() {
		var item RecentTransaction
		if err := rows.Scan(&item.LogTransEntryText, &item.SalesName, &item.EntryDate, &item.Total, &item.TransTypeID); err == nil {
			result = append(result, item)
		}
	}
	return c.JSON(result)
}
