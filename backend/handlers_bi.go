package main

import (
	"database/sql"
	"fmt"
	"math"
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
