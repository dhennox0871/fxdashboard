package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Database directory (folder containing .db files)
	dbDir := os.Getenv("DB_DIR")
	if dbDir == "" {
		dbDir = "." // default: current folder
	}

	log.Println("Scanning databases in:", dbDir)
	if err := DBPool.Init(dbDir); err != nil {
		log.Fatalf("Failed to initialize database pool: %v", err)
	}

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

	api.Get("/annually/kpi", GetAnnuallyKPI)
	api.Get("/annually/chart", GetAnnuallyChart)
	api.Get("/annually/cashier", GetAnnuallyCashier)

	api.Get("/settings/company", GetCompanyInfo)
	api.Get("/settings/last-sync", GetLastSync)
	api.Post("/settings/sync", PostSync)
	api.Post("/settings/sync/clear", ClearDatabase)

	// Super User Only Management Routes
	mgr := api.Group("/manager", SuperOnly)
	mgr.Get("/connections", GetManagerConnections)
	mgr.Post("/connections", PostManagerConnection)
	mgr.Put("/connections/:id", UpdateManagerConnection)
	mgr.Delete("/connections/:id", DeleteManagerConnection)

	mgr.Get("/users", GetManagerUsers)
	mgr.Post("/users", PostManagerUser)
	mgr.Put("/users/:username", UpdateManagerUser)

	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}
	log.Printf("Server running on port %s", port)
	app.Listen(":" + port)
}
