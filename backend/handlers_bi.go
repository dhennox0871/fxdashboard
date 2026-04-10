package main

import (
	"database/sql"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
)

type DOIItem struct {
	ItemID        int      `json:"item_id"`
	ItemCode      string   `json:"item_code"`
	ItemName      string   `json:"item_name"`
	BaseUOM       string   `json:"base_uom"`
	WarehouseID   *int     `json:"warehouse_id,omitempty"`
	WarehouseCode string   `json:"warehouse_code,omitempty"`
	StockQty      float64  `json:"stock_qty"`
	NetSoldQty    float64  `json:"net_sold_qty"`
	AvgDailySold  float64  `json:"avg_daily_sold"`
	DOI           *float64 `json:"doi"`
	Status        string   `json:"status"`
}

type BIExecutiveKPIResponse struct {
	Period       string  `json:"period"`
	Revenue      float64 `json:"revenue"`
	Orders       int64   `json:"orders"`
	UnitsSold    float64 `json:"units_sold"`
	GrossProfit  float64 `json:"gross_profit"`
	GrossMargin  float64 `json:"gross_margin"`
	AOV          float64 `json:"aov"`
	TargetMargin float64 `json:"target_margin"`
}

type BIRevenueTrendPoint struct {
	Date    string  `json:"date"`
	Revenue float64 `json:"revenue"`
}

type BIChannelContributionItem struct {
	Channel      string  `json:"channel"`
	Revenue      float64 `json:"revenue"`
	Contribution float64 `json:"contribution"`
}

type BIBusinessHealthResponse struct {
	Period               string  `json:"period"`
	DOIDays              int     `json:"doi_days"`
	OutOfStockSKU        int     `json:"out_of_stock_sku"`
	SKULt14DaysStock     int     `json:"sku_lt_14_days_stock"`
	SlowMovingSKU        int     `json:"slow_moving_sku"`
	CancelRate           float64 `json:"cancel_rate"`
	MarginBelowTargetSKU int     `json:"margin_below_target_sku"`
}

type BISnapshotTopItem struct {
	ItemID    int     `json:"item_id"`
	ItemCode  string  `json:"item_code"`
	ItemName  string  `json:"item_name"`
	Revenue   float64 `json:"revenue"`
	MarginPct float64 `json:"margin_pct"`
}

type BISnapshotRiskItem struct {
	ItemID     int     `json:"item_id"`
	ItemCode   string  `json:"item_code"`
	ItemName   string  `json:"item_name"`
	StockQty   float64 `json:"stock_qty"`
	STRPercent float64 `json:"str_percent"`
}

type BIProductSnapshotResponse struct {
	Period     string               `json:"period"`
	TopRevenue []BISnapshotTopItem  `json:"top_revenue"`
	BottomRisk []BISnapshotRiskItem `json:"bottom_risk"`
}

type BIProductKPIResponse struct {
	Period      string  `json:"period"`
	Revenue     float64 `json:"revenue"`
	Units       float64 `json:"units"`
	AvgMargin   float64 `json:"avg_margin"`
	SellThrough float64 `json:"sell_through"`
}

type BICategoryPerformanceItem struct {
	Category  string  `json:"category"`
	Revenue   float64 `json:"revenue"`
	Units     float64 `json:"units"`
	MarginPct float64 `json:"margin_pct"`
}

type BIProductLifecycleItem struct {
	Phase   string  `json:"phase"`
	Count   int     `json:"count"`
	Percent float64 `json:"percent"`
}

type BIProductPerformanceItem struct {
	ItemID     int     `json:"item_id"`
	ItemCode   string  `json:"item_code"`
	ItemName   string  `json:"item_name"`
	Revenue    float64 `json:"revenue"`
	Units      float64 `json:"units"`
	StockQty   float64 `json:"stock_qty"`
	MarginPct  float64 `json:"margin_pct"`
	STRPercent float64 `json:"str_percent"`
}

type BIProductPerformanceResponse struct {
	Period string                     `json:"period"`
	Top    []BIProductPerformanceItem `json:"top"`
	Slow   []BIProductPerformanceItem `json:"slow"`
}

func parseBIKPIType(c *fiber.Ctx) string {
	v := strings.ToLower(strings.TrimSpace(c.Query("period", "mtd")))
	if v == "today" {
		return "today"
	}
	return "mtd"
}

func biPeriodFilter(period string, dateExpr string) string {
	if period == "today" {
		return "DATE(" + dateExpr + ") = DATE('now', 'localtime')"
	}
	return "strftime('%Y-%m', " + dateExpr + ") = strftime('%Y-%m', 'now', 'localtime')"
}

func biNetRevenueExpr(ltAlias, ltlAlias string) string {
	return `CASE
		WHEN ` + ltAlias + `.transtypeid IN (10, 18) AND ` + ltlAlias + `.qty < 0 THEN ABS(COALESCE(` + ltlAlias + `.netvalue, 0))
		WHEN ` + ltAlias + `.transtypeid IN (11, 19) AND ` + ltlAlias + `.qty > 0 THEN -ABS(COALESCE(` + ltlAlias + `.netvalue, 0))
		ELSE 0
	END`
}

func biCOGSExpr(db *sql.DB, ltAlias, ltlAlias string) string {
	if columnExists(db, "logtransline", "totalhpp") {
		return `CASE
			WHEN ` + ltAlias + `.transtypeid IN (10, 18) AND ` + ltlAlias + `.qty < 0 THEN ABS(COALESCE(` + ltlAlias + `.totalhpp, 0))
			WHEN ` + ltAlias + `.transtypeid IN (11, 19) AND ` + ltlAlias + `.qty > 0 THEN -ABS(COALESCE(` + ltlAlias + `.totalhpp, 0))
			ELSE 0
		END`
	}
	if columnExists(db, "logtransline", "hpp") {
		return `CASE
			WHEN ` + ltAlias + `.transtypeid IN (10, 18) AND ` + ltlAlias + `.qty < 0 THEN ABS(COALESCE(` + ltlAlias + `.hpp, 0) * COALESCE(` + ltlAlias + `.qty, 0))
			WHEN ` + ltAlias + `.transtypeid IN (11, 19) AND ` + ltlAlias + `.qty > 0 THEN -ABS(COALESCE(` + ltlAlias + `.hpp, 0) * COALESCE(` + ltlAlias + `.qty, 0))
			ELSE 0
		END`
	}
	return "0"
}

func parseBIDays(c *fiber.Ctx, fallback int) int {
	raw := strings.TrimSpace(c.Query("days", strconv.Itoa(fallback)))
	d, err := strconv.Atoi(raw)
	if err != nil || d <= 0 {
		return fallback
	}
	if d > 365 {
		return 365
	}
	return d
}

func GetBIBusinessHealth(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}

	period := parseBIKPIType(c)
	days := parseBIDays(c, 30)

	stockByItem := map[int]float64{}
	if tableExists(db, "stockview") {
		rows, err := db.Query(`SELECT itemid, COALESCE(SUM(COALESCE(debet,0)-COALESCE(credit,0)),0) FROM stockview GROUP BY itemid`)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var itemID int
				var stock float64
				if rows.Scan(&itemID, &stock) == nil {
					stockByItem[itemID] = stock
				}
			}
		}
	}

	netSoldByItem := map[int]float64{}
	salesRows, err := db.Query(`SELECT
		ltl.itemid,
		COALESCE(SUM(
			CASE
				WHEN lt.transtypeid IN (10, 18) AND ltl.qty < 0 THEN -ltl.qty
				WHEN lt.transtypeid IN (11, 19) AND ltl.qty > 0 THEN -ltl.qty
				ELSE 0
			END
		),0) AS net_sold_qty
	FROM logtrans lt
	JOIN logtransline ltl ON ltl.logtransid = lt.logtransid
	WHERE ` + biPeriodFilter(period, "lt.entrydate") + `
		AND lt.transtypeid IN (10,11,18,19)
	GROUP BY ltl.itemid`)
	if err == nil {
		defer salesRows.Close()
		for salesRows.Next() {
			var itemID int
			var qty float64
			if salesRows.Scan(&itemID, &qty) == nil {
				netSoldByItem[itemID] = qty
			}
		}
	}

	keys := map[int]struct{}{}
	for k := range stockByItem {
		keys[k] = struct{}{}
	}
	for k := range netSoldByItem {
		keys[k] = struct{}{}
	}

	outOfStock := 0
	skuLt14 := 0
	slowMoving := 0
	for itemID := range keys {
		stock := stockByItem[itemID]
		netSold := netSoldByItem[itemID]
		avgDaily := netSold / float64(days)

		if stock <= 0 {
			outOfStock++
			continue
		}

		if avgDaily <= 0 {
			slowMoving++
			continue
		}

		doi := stock / avgDaily
		if doi < 14 {
			skuLt14++
		}
		if doi > 120 {
			slowMoving++
		}
	}

	var salesOrders int64
	_ = db.QueryRow(`SELECT COALESCE(COUNT(DISTINCT logtransid),0)
		FROM logtrans
		WHERE ` + biPeriodFilter(period, "entrydate") + `
			AND transtypeid IN (10,18)`).Scan(&salesOrders)

	var cancelOrders int64
	_ = db.QueryRow(`SELECT COALESCE(COUNT(DISTINCT logtransid),0)
		FROM logtrans
		WHERE ` + biPeriodFilter(period, "entrydate") + `
			AND transtypeid IN (11,19)`).Scan(&cancelOrders)

	cancelRate := 0.0
	if salesOrders > 0 {
		cancelRate = (float64(cancelOrders) / float64(salesOrders)) * 100
	}

	marginBelowTarget := 0
	cogsExpr := biCOGSExpr(db, "lt", "ltl")
	mRows, err := db.Query(`SELECT
		ltl.itemid,
		COALESCE(SUM(` + biNetRevenueExpr("lt", "ltl") + `),0) AS revenue,
		COALESCE(SUM(` + cogsExpr + `),0) AS cogs
	FROM logtrans lt
	JOIN logtransline ltl ON ltl.logtransid = lt.logtransid
	WHERE ` + biPeriodFilter(period, "lt.entrydate") + `
		AND lt.transtypeid IN (10,11,18,19)
	GROUP BY ltl.itemid`)
	if err == nil {
		defer mRows.Close()
		for mRows.Next() {
			var itemID int
			var revenue, cogs float64
			if mRows.Scan(&itemID, &revenue, &cogs) == nil {
				if revenue > 0 {
					margin := ((revenue - cogs) / revenue) * 100
					if margin < 40 {
						marginBelowTarget++
					}
				}
			}
		}
	}

	return c.JSON(BIBusinessHealthResponse{
		Period:               period,
		DOIDays:              days,
		OutOfStockSKU:        outOfStock,
		SKULt14DaysStock:     skuLt14,
		SlowMovingSKU:        slowMoving,
		CancelRate:           cancelRate,
		MarginBelowTargetSKU: marginBelowTarget,
	})
}

func GetBIProductSnapshot(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}

	period := parseBIKPIType(c)

	type salesAgg struct {
		ItemID   int
		ItemCode string
		ItemName string
		Revenue  float64
		Units    float64
		COGS     float64
	}

	agg := map[int]*salesAgg{}
	cogsExpr := biCOGSExpr(db, "lt", "ltl")
	rows, err := db.Query(`SELECT
		ltl.itemid,
		COALESCE(mi.itemcode, ''),
		COALESCE(mi.itemname, ''),
		COALESCE(SUM(` + biNetRevenueExpr("lt", "ltl") + `),0) AS revenue,
		COALESCE(SUM(CASE
			WHEN lt.transtypeid IN (10, 18) AND ltl.qty < 0 THEN -ltl.qty
			WHEN lt.transtypeid IN (11, 19) AND ltl.qty > 0 THEN -ltl.qty
			ELSE 0 END),0) AS units,
		COALESCE(SUM(` + cogsExpr + `),0) AS cogs
	FROM logtrans lt
	JOIN logtransline ltl ON ltl.logtransid = lt.logtransid
	LEFT JOIN masteritem mi ON mi.itemid = ltl.itemid
	WHERE ` + biPeriodFilter(period, "lt.entrydate") + `
		AND lt.transtypeid IN (10,11,18,19)
	GROUP BY ltl.itemid, COALESCE(mi.itemcode, ''), COALESCE(mi.itemname, '')`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca snapshot produk: " + err.Error()})
	}
	defer rows.Close()
	for rows.Next() {
		var a salesAgg
		if rows.Scan(&a.ItemID, &a.ItemCode, &a.ItemName, &a.Revenue, &a.Units, &a.COGS) == nil {
			agg[a.ItemID] = &a
		}
	}

	stockByItem := map[int]float64{}
	if tableExists(db, "stockview") {
		sRows, err := db.Query(`SELECT itemid, COALESCE(SUM(COALESCE(debet,0)-COALESCE(credit,0)),0) FROM stockview GROUP BY itemid`)
		if err == nil {
			defer sRows.Close()
			for sRows.Next() {
				var itemID int
				var stock float64
				if sRows.Scan(&itemID, &stock) == nil {
					stockByItem[itemID] = stock
					if _, ok := agg[itemID]; !ok {
						agg[itemID] = &salesAgg{ItemID: itemID}
					}
				}
			}
		}
	}

	items := make([]*salesAgg, 0, len(agg))
	for _, v := range agg {
		items = append(items, v)
	}

	topSource := make([]*salesAgg, 0, len(items))
	for _, it := range items {
		if it.Revenue > 0 {
			topSource = append(topSource, it)
		}
	}
	sort.Slice(topSource, func(i, j int) bool { return topSource[i].Revenue > topSource[j].Revenue })
	if len(topSource) > 5 {
		topSource = topSource[:5]
	}

	top := make([]BISnapshotTopItem, 0, len(topSource))
	for _, it := range topSource {
		margin := 0.0
		if it.Revenue > 0 {
			margin = ((it.Revenue - it.COGS) / it.Revenue) * 100
		}
		top = append(top, BISnapshotTopItem{
			ItemID:    it.ItemID,
			ItemCode:  it.ItemCode,
			ItemName:  it.ItemName,
			Revenue:   it.Revenue,
			MarginPct: margin,
		})
	}

	type riskTmp struct {
		ItemID   int
		ItemCode string
		ItemName string
		Stock    float64
		STR      float64
	}
	riskRows := make([]riskTmp, 0)
	for _, it := range items {
		stock := stockByItem[it.ItemID]
		if stock <= 0 {
			continue
		}
		denom := it.Units + stock
		strPct := 0.0
		if denom > 0 {
			strPct = (it.Units / denom) * 100
		}
		riskRows = append(riskRows, riskTmp{
			ItemID:   it.ItemID,
			ItemCode: it.ItemCode,
			ItemName: it.ItemName,
			Stock:    stock,
			STR:      strPct,
		})
	}
	sort.Slice(riskRows, func(i, j int) bool {
		if riskRows[i].STR == riskRows[j].STR {
			return riskRows[i].Stock > riskRows[j].Stock
		}
		return riskRows[i].STR < riskRows[j].STR
	})
	if len(riskRows) > 5 {
		riskRows = riskRows[:5]
	}

	bottom := make([]BISnapshotRiskItem, 0, len(riskRows))
	for _, r := range riskRows {
		bottom = append(bottom, BISnapshotRiskItem{
			ItemID:     r.ItemID,
			ItemCode:   r.ItemCode,
			ItemName:   r.ItemName,
			StockQty:   r.Stock,
			STRPercent: r.STR,
		})
	}

	return c.JSON(BIProductSnapshotResponse{
		Period:     period,
		TopRevenue: top,
		BottomRisk: bottom,
	})
}

func GetBIProductKPI(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}

	period := parseBIKPIType(c)
	cogsExpr := biCOGSExpr(db, "lt", "ltl")

	var revenue, units, cogs float64
	err := db.QueryRow(`SELECT
		COALESCE(SUM(`+biNetRevenueExpr("lt", "ltl")+`),0) AS revenue,
		COALESCE(SUM(CASE
			WHEN lt.transtypeid IN (10, 18) AND ltl.qty < 0 THEN -ltl.qty
			WHEN lt.transtypeid IN (11, 19) AND ltl.qty > 0 THEN -ltl.qty
			ELSE 0 END),0) AS units,
		COALESCE(SUM(`+cogsExpr+`),0) AS cogs
	FROM logtrans lt
	JOIN logtransline ltl ON ltl.logtransid = lt.logtransid
	WHERE `+biPeriodFilter(period, "lt.entrydate")+`
		AND lt.transtypeid IN (10,11,18,19)`).Scan(&revenue, &units, &cogs)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menghitung product KPI: " + err.Error()})
	}

	stockQty := 0.0
	if tableExists(db, "stockview") {
		_ = db.QueryRow(`SELECT COALESCE(SUM(COALESCE(debet,0)-COALESCE(credit,0)),0) FROM stockview`).Scan(&stockQty)
	}

	avgMargin := 0.0
	if revenue > 0 {
		avgMargin = ((revenue - cogs) / revenue) * 100
	}

	sellThrough := 0.0
	denom := units + stockQty
	if denom > 0 {
		sellThrough = (units / denom) * 100
	}

	return c.JSON(BIProductKPIResponse{
		Period:      period,
		Revenue:     revenue,
		Units:       units,
		AvgMargin:   avgMargin,
		SellThrough: sellThrough,
	})
}

func GetBICategoryPerformance(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}

	period := parseBIKPIType(c)
	cogsExpr := biCOGSExpr(db, "lt", "ltl")

	rows, err := db.Query(`SELECT
		COALESCE(mig.description, 'UNCATEGORIZED') AS category,
		COALESCE(SUM(` + biNetRevenueExpr("lt", "ltl") + `),0) AS revenue,
		COALESCE(SUM(CASE
			WHEN lt.transtypeid IN (10, 18) AND ltl.qty < 0 THEN -ltl.qty
			WHEN lt.transtypeid IN (11, 19) AND ltl.qty > 0 THEN -ltl.qty
			ELSE 0 END),0) AS units,
		COALESCE(SUM(` + cogsExpr + `),0) AS cogs
	FROM logtrans lt
	JOIN logtransline ltl ON ltl.logtransid = lt.logtransid
	LEFT JOIN masteritem mi ON mi.itemid = ltl.itemid
	LEFT JOIN masteritemgroup mig ON mig.itemgroupid = mi.itemgroupid
	WHERE ` + biPeriodFilter(period, "lt.entrydate") + `
		AND lt.transtypeid IN (10,11,18,19)
	GROUP BY COALESCE(mig.description, 'UNCATEGORIZED')
	HAVING COALESCE(SUM(` + biNetRevenueExpr("lt", "ltl") + `),0) <> 0
	ORDER BY revenue DESC`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca category performance: " + err.Error()})
	}
	defer rows.Close()

	result := make([]BICategoryPerformanceItem, 0)
	for rows.Next() {
		var item BICategoryPerformanceItem
		var cogs float64
		if rows.Scan(&item.Category, &item.Revenue, &item.Units, &cogs) == nil {
			if item.Revenue > 0 {
				item.MarginPct = ((item.Revenue - cogs) / item.Revenue) * 100
			}
			result = append(result, item)
		}
	}

	if err := rows.Err(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal memproses category performance: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"period": period,
		"rows":   result,
	})
}

func GetBIProductLifecycle(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}

	period := parseBIKPIType(c)

	type agg struct {
		units float64
		stock float64
	}
	byItem := map[int]*agg{}

	rows, err := db.Query(`SELECT
		ltl.itemid,
		COALESCE(SUM(CASE
			WHEN lt.transtypeid IN (10, 18) AND ltl.qty < 0 THEN -ltl.qty
			WHEN lt.transtypeid IN (11, 19) AND ltl.qty > 0 THEN -ltl.qty
			ELSE 0 END),0) AS units
	FROM logtrans lt
	JOIN logtransline ltl ON ltl.logtransid = lt.logtransid
	WHERE ` + biPeriodFilter(period, "lt.entrydate") + `
		AND lt.transtypeid IN (10,11,18,19)
	GROUP BY ltl.itemid`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var itemID int
			var units float64
			if rows.Scan(&itemID, &units) == nil {
				byItem[itemID] = &agg{units: units}
			}
		}
	}

	if tableExists(db, "stockview") {
		sRows, err := db.Query(`SELECT itemid, COALESCE(SUM(COALESCE(debet,0)-COALESCE(credit,0)),0) FROM stockview GROUP BY itemid`)
		if err == nil {
			defer sRows.Close()
			for sRows.Next() {
				var itemID int
				var stock float64
				if sRows.Scan(&itemID, &stock) == nil {
					if _, ok := byItem[itemID]; !ok {
						byItem[itemID] = &agg{}
					}
					byItem[itemID].stock = stock
				}
			}
		}
	}

	phaseCount := map[string]int{
		"Fast Moving":   0,
		"Healthy":       0,
		"Watchlist":     0,
		"Slow/Dead":     0,
		"Stockout Risk": 0,
	}

	total := 0
	for _, v := range byItem {
		denom := v.units + v.stock
		strPct := 0.0
		if denom > 0 {
			strPct = (v.units / denom) * 100
		}

		phase := "Slow/Dead"
		switch {
		case v.stock <= 0 && v.units > 0:
			phase = "Stockout Risk"
		case strPct >= 70:
			phase = "Fast Moving"
		case strPct >= 40:
			phase = "Healthy"
		case strPct >= 15:
			phase = "Watchlist"
		default:
			phase = "Slow/Dead"
		}

		phaseCount[phase]++
		total++
	}

	order := []string{"Fast Moving", "Healthy", "Watchlist", "Slow/Dead", "Stockout Risk"}
	rowsOut := make([]BIProductLifecycleItem, 0, len(order))
	for _, phase := range order {
		count := phaseCount[phase]
		pct := 0.0
		if total > 0 {
			pct = (float64(count) / float64(total)) * 100
		}
		rowsOut = append(rowsOut, BIProductLifecycleItem{Phase: phase, Count: count, Percent: pct})
	}

	return c.JSON(fiber.Map{
		"period": period,
		"rows":   rowsOut,
	})
}

func GetBIProductPerformance(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}

	period := parseBIKPIType(c)
	limit := parseBIDays(c, 8)
	if limit > 30 {
		limit = 30
	}

	type agg struct {
		ItemID   int
		ItemCode string
		ItemName string
		Revenue  float64
		Units    float64
		COGS     float64
		Stock    float64
	}

	byItem := map[int]*agg{}
	cogsExpr := biCOGSExpr(db, "lt", "ltl")

	rows, err := db.Query(`SELECT
		ltl.itemid,
		COALESCE(mi.itemcode, ''),
		COALESCE(mi.itemname, ''),
		COALESCE(SUM(` + biNetRevenueExpr("lt", "ltl") + `),0) AS revenue,
		COALESCE(SUM(CASE
			WHEN lt.transtypeid IN (10, 18) AND ltl.qty < 0 THEN -ltl.qty
			WHEN lt.transtypeid IN (11, 19) AND ltl.qty > 0 THEN -ltl.qty
			ELSE 0 END),0) AS units,
		COALESCE(SUM(` + cogsExpr + `),0) AS cogs
	FROM logtrans lt
	JOIN logtransline ltl ON ltl.logtransid = lt.logtransid
	LEFT JOIN masteritem mi ON mi.itemid = ltl.itemid
	WHERE ` + biPeriodFilter(period, "lt.entrydate") + `
		AND lt.transtypeid IN (10,11,18,19)
	GROUP BY ltl.itemid, COALESCE(mi.itemcode, ''), COALESCE(mi.itemname, '')`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca product performance: " + err.Error()})
	}
	defer rows.Close()
	for rows.Next() {
		var a agg
		if rows.Scan(&a.ItemID, &a.ItemCode, &a.ItemName, &a.Revenue, &a.Units, &a.COGS) == nil {
			byItem[a.ItemID] = &a
		}
	}

	if tableExists(db, "stockview") {
		sRows, err := db.Query(`SELECT itemid, COALESCE(SUM(COALESCE(debet,0)-COALESCE(credit,0)),0) FROM stockview GROUP BY itemid`)
		if err == nil {
			defer sRows.Close()
			for sRows.Next() {
				var itemID int
				var stock float64
				if sRows.Scan(&itemID, &stock) == nil {
					if _, ok := byItem[itemID]; !ok {
						byItem[itemID] = &agg{ItemID: itemID}
					}
					byItem[itemID].Stock = stock
				}
			}
		}
	}

	all := make([]BIProductPerformanceItem, 0, len(byItem))
	for _, v := range byItem {
		margin := 0.0
		if v.Revenue > 0 {
			margin = ((v.Revenue - v.COGS) / v.Revenue) * 100
		}
		strPct := 0.0
		if v.Units+v.Stock > 0 {
			strPct = (v.Units / (v.Units + v.Stock)) * 100
		}
		all = append(all, BIProductPerformanceItem{
			ItemID:     v.ItemID,
			ItemCode:   v.ItemCode,
			ItemName:   v.ItemName,
			Revenue:    v.Revenue,
			Units:      v.Units,
			StockQty:   v.Stock,
			MarginPct:  margin,
			STRPercent: strPct,
		})
	}

	top := make([]BIProductPerformanceItem, 0)
	for _, it := range all {
		if it.Revenue > 0 {
			top = append(top, it)
		}
	}
	sort.Slice(top, func(i, j int) bool { return top[i].Revenue > top[j].Revenue })
	if len(top) > limit {
		top = top[:limit]
	}

	slow := make([]BIProductPerformanceItem, 0)
	for _, it := range all {
		if it.StockQty <= 0 {
			continue
		}
		slow = append(slow, it)
	}
	sort.Slice(slow, func(i, j int) bool {
		if slow[i].STRPercent == slow[j].STRPercent {
			return slow[i].StockQty > slow[j].StockQty
		}
		return slow[i].STRPercent < slow[j].STRPercent
	})
	if len(slow) > limit {
		slow = slow[:limit]
	}

	return c.JSON(BIProductPerformanceResponse{
		Period: period,
		Top:    top,
		Slow:   slow,
	})
}

func GetBIRevenueTrend(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}

	period := parseBIKPIType(c)
	channel := strings.TrimSpace(c.Query("channel", ""))

	where := []string{
		biPeriodFilter(period, "lt.entrydate"),
		"lt.transtypeid IN (10, 11, 18, 19)",
	}
	args := make([]interface{}, 0)
	if channel != "" {
		where = append(where, "COALESCE(mc.description, '') = ?")
		args = append(args, channel)
	}

	query := `SELECT
		DATE(lt.entrydate) AS tx_date,
		COALESCE(SUM(` + biNetRevenueExpr("lt", "ltl") + `), 0) AS revenue
	FROM logtrans lt
	JOIN logtransline ltl ON ltl.logtransid = lt.logtransid
	LEFT JOIN mastercostcenter mc ON mc.costcenterid = lt.costcenterid
	WHERE ` + strings.Join(where, " AND ") + `
	GROUP BY DATE(lt.entrydate)
	ORDER BY DATE(lt.entrydate) ASC`

	rows, err := db.Query(query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca revenue trend: " + err.Error()})
	}
	defer rows.Close()

	result := make([]BIRevenueTrendPoint, 0)
	for rows.Next() {
		var p BIRevenueTrendPoint
		if err := rows.Scan(&p.Date, &p.Revenue); err == nil {
			result = append(result, p)
		}
	}

	if err := rows.Err(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal memproses revenue trend: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"period":  period,
		"channel": channel,
		"rows":    result,
	})
}

func GetBIChannelContribution(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}

	period := parseBIKPIType(c)
	query := `SELECT
		COALESCE(mc.description, 'UNKNOWN') AS channel,
		COALESCE(SUM(` + biNetRevenueExpr("lt", "ltl") + `), 0) AS revenue
	FROM logtrans lt
	JOIN logtransline ltl ON ltl.logtransid = lt.logtransid
	LEFT JOIN mastercostcenter mc ON mc.costcenterid = lt.costcenterid
	WHERE ` + biPeriodFilter(period, "lt.entrydate") + `
		AND lt.transtypeid IN (10, 11, 18, 19)
	GROUP BY COALESCE(mc.description, 'UNKNOWN')
	HAVING COALESCE(SUM(` + biNetRevenueExpr("lt", "ltl") + `), 0) <> 0
	ORDER BY revenue DESC`

	rows, err := db.Query(query)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca channel contribution: " + err.Error()})
	}
	defer rows.Close()

	result := make([]BIChannelContributionItem, 0)
	totalRevenue := 0.0
	for rows.Next() {
		var item BIChannelContributionItem
		if err := rows.Scan(&item.Channel, &item.Revenue); err == nil {
			totalRevenue += item.Revenue
			result = append(result, item)
		}
	}

	if err := rows.Err(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal memproses channel contribution: " + err.Error()})
	}

	if totalRevenue != 0 {
		for i := range result {
			result[i].Contribution = (result[i].Revenue / totalRevenue) * 100
		}
	}

	return c.JSON(fiber.Map{
		"period":        period,
		"total_revenue": totalRevenue,
		"rows":          result,
	})
}

func columnExists(db *sql.DB, tableName, columnName string) bool {
	rows, err := db.Query("PRAGMA table_info(" + tableName + ")")
	if err != nil {
		return false
	}
	defer rows.Close()

	var (
		cid     int
		name    string
		colType string
		notNull int
		dflt    sql.NullString
		pk      int
	)
	for rows.Next() {
		if err := rows.Scan(&cid, &name, &colType, &notNull, &dflt, &pk); err != nil {
			continue
		}
		if strings.EqualFold(name, columnName) {
			return true
		}
	}
	return false
}

func GetBIExecutiveKPI(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}

	period := parseBIKPIType(c)
	periodFilter := "strftime('%Y-%m', lt.entrydate) = strftime('%Y-%m', 'now', 'localtime')"
	if period == "today" {
		periodFilter = "DATE(lt.entrydate) = DATE('now', 'localtime')"
	}

	cogsExpr := "0"
	if columnExists(db, "logtransline", "totalhpp") {
		cogsExpr = `CASE
			WHEN lt.transtypeid IN (10, 18) AND ltl.qty < 0 THEN ABS(COALESCE(ltl.totalhpp, 0))
			WHEN lt.transtypeid IN (11, 19) AND ltl.qty > 0 THEN -ABS(COALESCE(ltl.totalhpp, 0))
			ELSE 0
		END`
	} else if columnExists(db, "logtransline", "hpp") {
		cogsExpr = `CASE
			WHEN lt.transtypeid IN (10, 18) AND ltl.qty < 0 THEN ABS(COALESCE(ltl.hpp, 0) * COALESCE(ltl.qty, 0))
			WHEN lt.transtypeid IN (11, 19) AND ltl.qty > 0 THEN -ABS(COALESCE(ltl.hpp, 0) * COALESCE(ltl.qty, 0))
			ELSE 0
		END`
	}

	query := `SELECT
		COALESCE(SUM(
			CASE
				WHEN lt.transtypeid IN (10, 18) AND ltl.qty < 0 THEN ABS(COALESCE(ltl.netvalue, 0))
				WHEN lt.transtypeid IN (11, 19) AND ltl.qty > 0 THEN -ABS(COALESCE(ltl.netvalue, 0))
				ELSE 0
			END
		), 0) AS revenue,
		COALESCE(SUM(
			CASE
				WHEN lt.transtypeid IN (10, 18) AND ltl.qty < 0 THEN ABS(COALESCE(ltl.qty, 0))
				WHEN lt.transtypeid IN (11, 19) AND ltl.qty > 0 THEN -ABS(COALESCE(ltl.qty, 0))
				ELSE 0
			END
		), 0) AS units_sold,
		COALESCE(SUM(` + cogsExpr + `), 0) AS total_cogs,
		COALESCE(COUNT(DISTINCT CASE WHEN lt.transtypeid IN (10, 18) THEN lt.logtransid END), 0) AS orders
	FROM logtrans lt
	JOIN logtransline ltl ON ltl.logtransid = lt.logtransid
	WHERE ` + periodFilter + `
		AND lt.transtypeid IN (10, 11, 18, 19)`

	var revenue, units, cogs float64
	var orders int64
	if err := db.QueryRow(query).Scan(&revenue, &units, &cogs, &orders); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menghitung KPI BI: " + err.Error()})
	}

	grossProfit := revenue - cogs
	grossMargin := 0.0
	if revenue > 0 {
		grossMargin = (grossProfit / revenue) * 100
	}

	aov := 0.0
	if orders > 0 {
		aov = revenue / float64(orders)
	}

	return c.JSON(BIExecutiveKPIResponse{
		Period:       period,
		Revenue:      revenue,
		Orders:       orders,
		UnitsSold:    units,
		GrossProfit:  grossProfit,
		GrossMargin:  grossMargin,
		AOV:          aov,
		TargetMargin: 40,
	})
}

func parseDOIDays(c *fiber.Ctx) int {
	raw := strings.TrimSpace(c.Query("days", "30"))
	d, err := strconv.Atoi(raw)
	if err != nil {
		return 30
	}
	switch d {
	case 30, 60, 90:
		return d
	default:
		return 30
	}
}

func parseDOIScope(c *fiber.Ctx) string {
	s := strings.ToLower(strings.TrimSpace(c.Query("scope", "global")))
	if s == "warehouse" {
		return "warehouse"
	}
	return "global"
}

func tableExists(db *sql.DB, tableName string) bool {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?", tableName).Scan(&count)
	if err != nil {
		return false
	}
	return count > 0
}

func calcDOIStatus(stockQty float64, avgDaily float64, doi *float64) string {
	if stockQty <= 0 {
		return "Out of Stock"
	}
	if avgDaily <= 0 {
		return "No Movement"
	}
	if doi == nil {
		return "No Movement"
	}
	if *doi < 14 {
		return "Urgent"
	}
	if *doi <= 45 {
		return "Waspada"
	}
	if *doi > 120 {
		return "Stok Mati"
	}
	return "Normal"
}

func GetBIDOI(c *fiber.Ctx) error {
	db := GetDB(c)
	if db == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database tidak tersedia"})
	}

	if !tableExists(db, "stockview") || !tableExists(db, "masterwarehouse") {
		return c.Status(400).JSON(fiber.Map{"error": "Data stock belum tersedia. Jalankan sinkronisasi terbaru (migrate_base.py) terlebih dahulu."})
	}

	days := parseDOIDays(c)
	scope := parseDOIScope(c)
	dateExpr := fmt.Sprintf("-%d days", days)

	query := `WITH stock AS (
		SELECT
			sv.itemid,
			CASE WHEN ? = 'warehouse' THEN COALESCE(sv.warehouseid, 0) ELSE 0 END AS scope_warehouseid,
			SUM(COALESCE(sv.debet, 0) - COALESCE(sv.credit, 0)) AS stock_qty
		FROM stockview sv
		GROUP BY sv.itemid, CASE WHEN ? = 'warehouse' THEN COALESCE(sv.warehouseid, 0) ELSE 0 END
	),
	sales AS (
		SELECT
			ltl.itemid,
			CASE WHEN ? = 'warehouse' THEN COALESCE(ltl.warehouseid, 0) ELSE 0 END AS scope_warehouseid,
			SUM(
				CASE
					WHEN lt.transtypeid IN (10, 18) AND ltl.qty < 0 THEN (-ltl.qty) *
						CASE
							WHEN COALESCE(ltl.uomid, 0) = COALESCE(mi.uomid, 0) OR COALESCE(ltl.uomid, 0) = 0 THEN 1
							ELSE COALESCE(muom.conversionqty, 1)
						END
					WHEN lt.transtypeid IN (11, 19) AND ltl.qty > 0 THEN (-ltl.qty) *
						CASE
							WHEN COALESCE(ltl.uomid, 0) = COALESCE(mi.uomid, 0) OR COALESCE(ltl.uomid, 0) = 0 THEN 1
							ELSE COALESCE(muom.conversionqty, 1)
						END
					ELSE 0
				END
			) AS net_sold_qty
		FROM logtransline ltl
		JOIN logtrans lt ON lt.logtransid = ltl.logtransid
		LEFT JOIN masteritem mi ON mi.itemid = ltl.itemid
		LEFT JOIN masteritemuom muom ON muom.itemid = ltl.itemid AND muom.uomid = ltl.uomid
		WHERE lt.entrydate >= datetime('now', ?)
			AND lt.transtypeid IN (10, 11, 18, 19)
		GROUP BY ltl.itemid, CASE WHEN ? = 'warehouse' THEN COALESCE(ltl.warehouseid, 0) ELSE 0 END
	)
	SELECT
		s.itemid,
		COALESCE(mi.itemcode, '') AS itemcode,
		COALESCE(mi.itemname, '') AS itemname,
		COALESCE(mu.uomcode, '') AS base_uom,
		s.scope_warehouseid,
		COALESCE(mw.warehousecode, CASE WHEN s.scope_warehouseid = 0 THEN 'GLOBAL' ELSE 'WH-' || s.scope_warehouseid END) AS warehousecode,
		COALESCE(s.stock_qty, 0) AS stock_qty,
		COALESCE(sa.net_sold_qty, 0) AS net_sold_qty
	FROM stock s
	LEFT JOIN sales sa ON sa.itemid = s.itemid AND sa.scope_warehouseid = s.scope_warehouseid
	LEFT JOIN masteritem mi ON mi.itemid = s.itemid
	LEFT JOIN masteruom mu ON mu.uomid = mi.uomid
	LEFT JOIN masterwarehouse mw ON mw.warehouseid = s.scope_warehouseid
	WHERE COALESCE(s.stock_qty, 0) <> 0 OR COALESCE(sa.net_sold_qty, 0) <> 0
	ORDER BY stock_qty DESC, net_sold_qty DESC, itemcode ASC`

	rows, err := db.Query(query, scope, scope, scope, dateExpr, scope)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca data DOI: " + err.Error()})
	}
	defer rows.Close()

	result := make([]DOIItem, 0)
	for rows.Next() {
		var item DOIItem
		var scopeWarehouseID int
		if err := rows.Scan(
			&item.ItemID,
			&item.ItemCode,
			&item.ItemName,
			&item.BaseUOM,
			&scopeWarehouseID,
			&item.WarehouseCode,
			&item.StockQty,
			&item.NetSoldQty,
		); err != nil {
			continue
		}

		if scope == "warehouse" && scopeWarehouseID != 0 {
			wid := scopeWarehouseID
			item.WarehouseID = &wid
		} else if scope == "global" {
			item.WarehouseCode = "GLOBAL"
		}

		avgDaily := item.NetSoldQty / float64(days)
		item.AvgDailySold = avgDaily
		if avgDaily > 0 {
			d := item.StockQty / avgDaily
			if !math.IsNaN(d) && !math.IsInf(d, 0) {
				item.DOI = &d
			}
		}
		item.Status = calcDOIStatus(item.StockQty, avgDaily, item.DOI)
		result = append(result, item)
	}

	if err := rows.Err(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal memproses data DOI: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"days":  days,
		"scope": scope,
		"rows":  result,
	})
}
