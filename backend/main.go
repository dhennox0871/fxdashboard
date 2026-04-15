package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Database directory (folder containing .db files)
	dbDir := resolveDBDir()

	log.Println("Scanning databases in:", dbDir)
	if err := DBPool.Init(dbDir); err != nil {
		log.Fatalf("Failed to initialize database pool: %v", err)
	}
	EnsureDashboardUsersForAllDatabases()

	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	// Public Routes
	app.Get("/api/databases", GetDatabases)
	app.Post("/api/auth/login", PostLogin)

	// Protected Routes
	api := app.Group("/api", AuthRequired())
	api.Get("/auth/me", GetMe)

	api.Get("/daily/kpi", GetDailyKPI)
	api.Get("/daily/group", GetDailyGroup)
	api.Get("/daily/costcenter", GetDailyCostcenter)
	api.Get("/daily/chart", GetDailyChart)
	api.Get("/daily/cashier", GetDailyCashier)
	api.Get("/daily/recent", GetDailyRecent)
	api.Get("/daily/source-transactions", GetDailySourceTransactions)

	api.Get("/annually/kpi", GetAnnuallyKPI)
	api.Get("/annually/chart", GetAnnuallyChart)
	api.Get("/annually/cashier", GetAnnuallyCashier)
	api.Get("/bi/executive-kpi", GetBIExecutiveKPI)
	api.Get("/bi/revenue-trend", GetBIRevenueTrend)
	api.Get("/bi/channel-contribution", GetBIChannelContribution)
	api.Get("/bi/business-health", GetBIBusinessHealth)
	api.Get("/bi/product-snapshot", GetBIProductSnapshot)
	api.Get("/bi/doi", GetBIDOI)
	api.Get("/bi/product-kpi", GetBIProductKPI)
	api.Get("/bi/category-performance", GetBICategoryPerformance)
	api.Get("/bi/product-lifecycle", GetBIProductLifecycle)
	api.Get("/bi/product-performance", GetBIProductPerformance)

	api.Get("/settings/company", GetCompanyInfo)
	api.Get("/settings/last-sync", GetLastSync)
	api.Post("/settings/sync", PostSync)
	api.Get("/settings/sync-status", GetSyncStatus)
	api.Get("/settings/databases", GetDatabaseManagementList)
	api.Post("/settings/databases", UpsertDatabaseSource)
	api.Delete("/settings/databases/:name", DeleteDatabaseSource)
	api.Post("/settings/databases/:name/status", SetDatabaseStatus)
	api.Post("/settings/databases/:name/sync", PostSyncDatabaseByName)

	api.Get("/users", GetManageUsers)
	api.Get("/users/databases", GetManageUserDatabases)
	api.Post("/users", CreateManageUser)
	api.Post("/users/change-password", ChangeOwnPassword)
	api.Post("/users/:username/reset-password", ResetManageUserPassword)
	api.Delete("/users/:username", DeleteManageUser)
	api.Post("/users/:username/menus", UpdateManageUserMenus)

	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}
	log.Printf("Server running on port %s", port)
	app.Listen(":" + port)
}

func resolveDBDir() string {
	if envDir := os.Getenv("DB_DIR"); envDir != "" {
		return envDir
	}

	candidates := []string{
		"./data",
		"../data",
		".",
	}

	for _, candidate := range candidates {
		if stat, err := os.Stat(candidate); err == nil && stat.IsDir() {
			abs, absErr := filepath.Abs(candidate)
			if absErr == nil {
				return abs
			}
			return candidate
		}
	}

	return "."
}
