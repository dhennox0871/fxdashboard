package main

import (
	"log"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

type DailySourceTransactionRow struct {
	NomorNota   string  `json:"nomor_nota"`
	Tanggal     string  `json:"tanggal"`
	NilaiRupiah float64 `json:"nilai_rupiah"`
}

type DailySourceSummary struct {
	TotalOrders  int     `json:"total_orders"`
	TotalRevenue float64 `json:"total_revenue"`
	AssemblyQty  float64 `json:"assembly_qty"`
	ProductionQty float64 `json:"production_qty"`
}

type DailySourceResponse struct {
	Rows    []DailySourceTransactionRow `json:"rows"`
	Summary DailySourceSummary          `json:"summary"`
}

type DailyProductionRow struct {
	EntryDate        string  `json:"entrydate"`
	FreeDescription1 string  `json:"freedescription1"`
	CostCenterID     int64   `json:"costcenterid"`
	CostCenterName   string  `json:"costcenter_name"`
	ItemGroupCode    string  `json:"itemgroupcode"`
	ItemGroupName    string  `json:"itemgroup_description"`
	TotalQty         float64 `json:"total_qty"`
}

type DailyProductionSummary struct {
	TotalRows int     `json:"total_rows"`
	TotalQty  float64 `json:"total_qty"`
}

type DailyProductionResponse struct {
	Rows    []DailyProductionRow     `json:"rows"`
	Summary DailyProductionSummary   `json:"summary"`
}

type DailyProductionComparisonResponse struct {
	Dates []string             `json:"dates"`
	Rows  []DailyProductionRow `json:"rows"`
}

func getDateRange(c *fiber.Ctx) (string, string) {
	startDate := c.Query("startDate", "19700101")
	endDate := c.Query("endDate", "20991231")
	log.Printf("DEBUG: Received startDate=%s, endDate=%s", startDate, endDate)
	startFmt := startDate[:4] + "-" + startDate[4:6] + "-" + startDate[6:8] + " 00:00:00"
	endFmt := endDate[:4] + "-" + endDate[4:6] + "-" + endDate[6:8] + " 23:59:59"
	return startFmt, endFmt
}

func isSKSMRTDatabase(c *fiber.Ctx) bool {
	dbName, ok := c.Locals("database").(string)
	if !ok {
		return false
	}
	return dbName == "SKSMRT"
}

func GetDailyKPI(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}
	startStr, endStr := getDateRange(c)
	q := `SELECT COALESCE(SUM(CASE 
			WHEN lt.transtypeid IN (10, 11, 18, 19) THEN -(ltl.netvalue + ltl.pajakvalue) 
			ELSE 0 END), 0), COUNT(DISTINCT lt.logtransid)
		FROM logtrans lt JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
		WHERE lt.entrydate BETWEEN ? AND ? AND lt.transtypeid IN (10, 11, 18, 19)`
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
		WHERE logtrans.entrydate BETWEEN ? AND ? AND logtrans.transtypeid IN (10, 11, 18, 19)
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
	q := `SELECT mastercostcenter.description, COALESCE(-SUM(logtransline.netvalue + logtransline.pajakvalue), 0) as total
		FROM logtrans JOIN logtransline ON logtrans.logtransid = logtransline.logtransid
		JOIN mastercostcenter ON logtrans.costcenterid = mastercostcenter.costcenterid
		WHERE logtrans.entrydate BETWEEN ? AND ? AND logtrans.transtypeid IN (10, 11, 18, 19)
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
		COALESCE(SUM(CASE WHEN lt.transtypeid IN (18, 19) THEN -(ltl.netvalue + ltl.pajakvalue) ELSE 0 END), 0) as tunai,
		COALESCE(SUM(CASE WHEN lt.transtypeid IN (10, 11) THEN -(ltl.netvalue + ltl.pajakvalue) ELSE 0 END), 0) as kredit
		FROM logtrans lt JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
		WHERE lt.entrydate BETWEEN ? AND ? AND lt.transtypeid IN (10, 11, 18, 19)
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
	q := `SELECT createby, COALESCE(-SUM(logtransline.netvalue + logtransline.pajakvalue), 0) as total
		FROM logtrans JOIN logtransline ON logtrans.logtransid = logtransline.logtransid
		WHERE logtrans.entrydate BETWEEN ? AND ? AND logtrans.transtypeid IN (10, 11, 18, 19)
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
		COALESCE(-SUM(ltl.netvalue + ltl.pajakvalue), 0), lt.transtypeid
		FROM logtrans lt JOIN masterrepresentative r ON lt.representativeid = r.representativeid
		JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
		WHERE lt.entrydate BETWEEN ? AND ? AND lt.transtypeid IN (10, 11, 18, 19)
		GROUP BY lt.logtransid, lt.logtransentrytext, r.name, lt.entrydate, lt.transtypeid
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

func GetDailySourceTransactions(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}

	startStr, endStr := getDateRange(c)
	dateFilter := c.Query("date", "")
	limitParam := c.Query("limit", "2000")

	limit := 2000
	if parsed, err := strconv.Atoi(limitParam); err == nil {
		if parsed > 0 && parsed <= 10000 {
			limit = parsed
		}
	}

	whereClause := "WHERE lt.entrydate BETWEEN ? AND ?"
	args := []interface{}{startStr, endStr}
	if dateFilter != "" {
		whereClause += " AND DATE(lt.entrydate) = ?"
		args = append(args, dateFilter)
	}

	summaryQuery := `
		SELECT
			COUNT(DISTINCT CASE WHEN lt.transtypeid IN (10, 11, 18, 19) THEN lt.logtransid END) AS total_orders,
			COALESCE(SUM(CASE
				WHEN lt.transtypeid IN (10, 11, 18, 19) THEN -(ltl.netvalue + ltl.pajakvalue)
				ELSE 0
			END), 0) AS total_revenue,
			COALESCE(SUM(CASE
				WHEN lt.transtypeid = 47 THEN ABS(COALESCE(ltl.qty, 0))
				ELSE 0
			END), 0) AS assembly_qty
		FROM logtrans lt
		JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
		` + whereClause

	var summary DailySourceSummary
	if err := db.QueryRow(summaryQuery, args...).Scan(&summary.TotalOrders, &summary.TotalRevenue, &summary.AssemblyQty); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	rowsQuery := `
		SELECT
			COALESCE(NULLIF(lt.logtransentrytext, ''), CAST(lt.logtransid AS TEXT)) AS nomor_nota,
			strftime('%Y-%m-%d %H:%M', lt.entrydate) AS tanggal,
			SUM(CASE
				WHEN lt.transtypeid IN (10, 11, 18, 19) THEN -(ltl.netvalue + ltl.pajakvalue)
				ELSE 0
			END) AS nilai_rupiah
		FROM logtrans lt
		JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
		` + whereClause + `
		AND lt.transtypeid IN (10, 11, 18, 19)
		GROUP BY lt.logtransid, lt.logtransentrytext, lt.entrydate
		ORDER BY lt.entrydate DESC
		LIMIT ?`

	rowArgs := append(append([]interface{}{}, args...), limit)
	rows, err := db.Query(rowsQuery, rowArgs...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	result := make([]DailySourceTransactionRow, 0)
	for rows.Next() {
		var item DailySourceTransactionRow
		if err := rows.Scan(&item.NomorNota, &item.Tanggal, &item.NilaiRupiah); err == nil {
			result = append(result, item)
		}
	}

	return c.JSON(DailySourceResponse{
		Rows:    result,
		Summary: summary,
	})
}

func GetDailyProduction(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}

	startStr, endStr := getDateRange(c)
	dateFilter := c.Query("date", "")
	limitParam := c.Query("limit", "10000")

	limit := 10000
	if parsed, err := strconv.Atoi(limitParam); err == nil {
		if parsed > 0 && parsed <= 20000 {
			limit = parsed
		}
	}

	whereClause := `
		WHERE lt.entrydate BETWEEN ? AND ?
		AND lt.transtypeid = 45
		AND lt.costcenterid IS NOT NULL`
	args := []interface{}{startStr, endStr}
	if dateFilter != "" {
		whereClause += " AND DATE(lt.entrydate) = ?"
		args = append(args, dateFilter)
	}

	summaryQuery := `
		SELECT
			COUNT(*) AS total_rows,
			COALESCE(SUM(COALESCE(ltl.qty, 0)), 0) AS total_qty
		FROM logtrans lt
		JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
		` + whereClause

	var summary DailyProductionSummary
	if err := db.QueryRow(summaryQuery, args...).Scan(&summary.TotalRows, &summary.TotalQty); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if summary.TotalRows == 0 {
		whereClause = `
			WHERE lt.entrydate BETWEEN ? AND ?
			AND lt.transtypeid = 45`
		args = []interface{}{startStr, endStr}
		if dateFilter != "" {
			whereClause += " AND COALESCE(DATE(lt.entrydate), substr(CAST(lt.entrydate AS TEXT), 1, 10)) = ?"
			args = append(args, dateFilter)
		}

		summaryQuery = `
			SELECT
				COUNT(*) AS total_rows,
				COALESCE(SUM(COALESCE(ltl.qty, 0)), 0) AS total_qty
			FROM logtrans lt
			JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
			` + whereClause

		if err := db.QueryRow(summaryQuery, args...).Scan(&summary.TotalRows, &summary.TotalQty); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
	}

	freeDescriptionExpr := "COALESCE(lt.freedescription1, '')"
	groupByFreeDescription := "lt.freedescription1"
	if !columnExists(db, "logtrans", "freedescription1") {
		freeDescriptionExpr = "''"
		groupByFreeDescription = "''"
	}

	rowsQuery := `
		SELECT
			COALESCE(DATE(lt.entrydate), substr(CAST(lt.entrydate AS TEXT), 1, 10)) AS entrydate,
			` + freeDescriptionExpr + ` AS freedescription1,
			lt.costcenterid,
			COALESCE(mc.description, '') AS costcenter_name,
			COALESCE(mig.itemgroupcode, '') AS itemgroupcode,
			COALESCE(mig.description, '') AS itemgroup_description,
			COALESCE(SUM(COALESCE(ltl.qty, 0)), 0) AS total_qty
		FROM logtrans lt
		JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
		LEFT JOIN mastercostcenter mc ON lt.costcenterid = mc.costcenterid
		LEFT JOIN masteritem mi ON ltl.itemid = mi.itemid
		LEFT JOIN masteritemgroup mig ON mi.itemgroupid = mig.itemgroupid
		` + whereClause + `
		GROUP BY COALESCE(DATE(lt.entrydate), substr(CAST(lt.entrydate AS TEXT), 1, 10)), ` + groupByFreeDescription + `, lt.costcenterid, mc.description, mig.itemgroupcode, mig.description
		ORDER BY COALESCE(DATE(lt.entrydate), substr(CAST(lt.entrydate AS TEXT), 1, 10)) DESC, total_qty DESC
		LIMIT ?`

	rowArgs := append(append([]interface{}{}, args...), limit)
	rows, err := db.Query(rowsQuery, rowArgs...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	result := make([]DailyProductionRow, 0)
	for rows.Next() {
		var item DailyProductionRow
		if err := rows.Scan(
			&item.EntryDate,
			&item.FreeDescription1,
			&item.CostCenterID,
			&item.CostCenterName,
			&item.ItemGroupCode,
			&item.ItemGroupName,
			&item.TotalQty,
		); err == nil {
			result = append(result, item)
		}
	}

	return c.JSON(DailyProductionResponse{
		Rows:    result,
		Summary: summary,
	})
}

func GetDailyProductionComparison(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}

	loadDates := func(requireCostcenter bool) ([]string, error) {
		condition := ""
		if requireCostcenter {
			condition = "AND costcenterid IS NOT NULL"
		}
		datesRows, qErr := db.Query(`
			SELECT DISTINCT COALESCE(DATE(entrydate), substr(CAST(entrydate AS TEXT), 1, 10)) AS tgl
			FROM logtrans
			WHERE transtypeid = 45
			  ` + condition + `
			ORDER BY tgl DESC
			LIMIT 5`)
		if qErr != nil {
			return nil, qErr
		}
		defer datesRows.Close()

		result := make([]string, 0, 5)
		for datesRows.Next() {
			var tgl string
			if scanErr := datesRows.Scan(&tgl); scanErr == nil && tgl != "" {
				result = append(result, tgl)
			}
		}
		return result, nil
	}

	dates, err := loadDates(true)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	requireCostcenter := true
	if len(dates) == 0 {
		requireCostcenter = false
		dates, err = loadDates(false)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
	}

	if len(dates) == 0 {
		return c.JSON(DailyProductionComparisonResponse{Dates: []string{}, Rows: []DailyProductionRow{}})
	}

	freeDescriptionExpr := "COALESCE(lt.freedescription1, '')"
	groupByFreeDescription := "lt.freedescription1"
	if !columnExists(db, "logtrans", "freedescription1") {
		freeDescriptionExpr = "''"
		groupByFreeDescription = "''"
	}

	placeholders := "?"
	args := make([]interface{}, 0, len(dates))
	args = append(args, dates[0])
	for i := 1; i < len(dates); i++ {
		placeholders += ", ?"
		args = append(args, dates[i])
	}

	q := `
		SELECT
			COALESCE(DATE(lt.entrydate), substr(CAST(lt.entrydate AS TEXT), 1, 10)) AS entrydate,
			` + freeDescriptionExpr + ` AS freedescription1,
			lt.costcenterid,
			COALESCE(mc.description, '') AS costcenter_name,
			COALESCE(mig.itemgroupcode, '') AS itemgroupcode,
			COALESCE(mig.description, '') AS itemgroup_description,
			COALESCE(SUM(COALESCE(ltl.qty, 0)), 0) AS total_qty
		FROM logtrans lt
		JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
		LEFT JOIN mastercostcenter mc ON lt.costcenterid = mc.costcenterid
		LEFT JOIN masteritem mi ON ltl.itemid = mi.itemid
		LEFT JOIN masteritemgroup mig ON mi.itemgroupid = mig.itemgroupid
		WHERE lt.transtypeid = 45
		  ` + func() string {
			if requireCostcenter {
				return "AND lt.costcenterid IS NOT NULL"
			}
			return ""
		}() + `
		  AND COALESCE(DATE(lt.entrydate), substr(CAST(lt.entrydate AS TEXT), 1, 10)) IN (` + placeholders + `)
		GROUP BY COALESCE(DATE(lt.entrydate), substr(CAST(lt.entrydate AS TEXT), 1, 10)), ` + groupByFreeDescription + `, lt.costcenterid, mc.description, mig.itemgroupcode, mig.description
		ORDER BY COALESCE(DATE(lt.entrydate), substr(CAST(lt.entrydate AS TEXT), 1, 10)) DESC, costcenter_name, itemgroup_description, freedescription1`

	rows, err := db.Query(q, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	result := make([]DailyProductionRow, 0)
	for rows.Next() {
		var item DailyProductionRow
		if scanErr := rows.Scan(
			&item.EntryDate,
			&item.FreeDescription1,
			&item.CostCenterID,
			&item.CostCenterName,
			&item.ItemGroupCode,
			&item.ItemGroupName,
			&item.TotalQty,
		); scanErr == nil {
			result = append(result, item)
		}
	}

	return c.JSON(DailyProductionComparisonResponse{Dates: dates, Rows: result})
}

func GetLastSync(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}
	var lastSync string
	err := db.QueryRow("SELECT data FROM coreapplication WHERE flag = 99999 LIMIT 1").Scan(&lastSync)
	if err != nil {
		return c.JSON(fiber.Map{"last_sync": "Belum pernah sinkronisasi"})
	}
	return c.JSON(fiber.Map{"last_sync": lastSync})
}
