package main

import (
	"bufio"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

type CompanyInfoResponse struct {
	CompanyName string `json:"company_name"`
}

type SyncProgress struct {
	Database       string    `json:"database"`
	Running        bool      `json:"running"`
	Percent        int       `json:"percent"`
	CurrentStep    int       `json:"current_step"`
	TotalSteps     int       `json:"total_steps"`
	RemainingSteps int       `json:"remaining_steps"`
	Message        string    `json:"message"`
	Error          string    `json:"error,omitempty"`
	StartedAt      time.Time `json:"started_at,omitempty"`
	FinishedAt     time.Time `json:"finished_at,omitempty"`
}

var (
	syncProgressMu   sync.RWMutex
	syncProgressByDB = map[string]*SyncProgress{}
)

func setSyncProgress(dbName string, mutator func(*SyncProgress)) {
	syncProgressMu.Lock()
	defer syncProgressMu.Unlock()
	state, ok := syncProgressByDB[dbName]
	if !ok {
		state = &SyncProgress{Database: strings.ToUpper(dbName), TotalSteps: 12}
		syncProgressByDB[dbName] = state
	}
	mutator(state)
	if state.TotalSteps <= 0 {
		state.TotalSteps = 12
	}
	if state.CurrentStep < 0 {
		state.CurrentStep = 0
	}
	if state.CurrentStep > state.TotalSteps {
		state.CurrentStep = state.TotalSteps
	}
	state.RemainingSteps = state.TotalSteps - state.CurrentStep
	if state.RemainingSteps < 0 {
		state.RemainingSteps = 0
	}
	if state.Percent < 0 {
		state.Percent = 0
	}
	if state.Percent > 100 {
		state.Percent = 100
	}
}

func getSyncProgress(dbName string) *SyncProgress {
	syncProgressMu.RLock()
	defer syncProgressMu.RUnlock()
	state, ok := syncProgressByDB[dbName]
	if !ok {
		return nil
	}
	clone := *state
	return &clone
}

func startSyncJob(dbName, script string, scriptArgs []string, env map[string]string) error {
	current := getSyncProgress(dbName)
	if current != nil && current.Running {
		return fmt.Errorf("Sinkronisasi masih berjalan untuk database %s", strings.ToUpper(dbName))
	}

	setSyncProgress(dbName, func(s *SyncProgress) {
		s.Database = strings.ToUpper(dbName)
		s.Running = true
		s.Percent = 8
		s.CurrentStep = 1
		s.TotalSteps = 12
		s.Message = "Memulai proses sinkronisasi..."
		s.Error = ""
		s.StartedAt = time.Now()
		s.FinishedAt = time.Time{}
	})

	pythonCmd, preArgs, err := resolvePythonCommand()
	if err != nil {
		setSyncProgress(dbName, func(s *SyncProgress) {
			s.Running = false
			s.Error = err.Error()
			s.Message = "Gagal memulai sinkronisasi"
			s.FinishedAt = time.Now()
		})
		return err
	}

	go func() {
		cmdArgs := append([]string{}, preArgs...)
		cmdArgs = append(cmdArgs, script)
		cmdArgs = append(cmdArgs, scriptArgs...)

		cmd := exec.Command(pythonCmd, cmdArgs...)
		cmd.Dir = "."
		if len(env) > 0 {
			cmd.Env = os.Environ()
			for k, v := range env {
				cmd.Env = append(cmd.Env, k+"="+v)
			}
		}

		stdout, err := cmd.StdoutPipe()
		if err != nil {
			setSyncProgress(dbName, func(s *SyncProgress) {
				s.Running = false
				s.Error = "Gagal membuka output sinkronisasi"
				s.Message = "Sinkronisasi gagal"
				s.FinishedAt = time.Now()
			})
			return
		}
		stderr, err := cmd.StderrPipe()
		if err != nil {
			setSyncProgress(dbName, func(s *SyncProgress) {
				s.Running = false
				s.Error = "Gagal membuka error stream sinkronisasi"
				s.Message = "Sinkronisasi gagal"
				s.FinishedAt = time.Now()
			})
			return
		}

		if err := cmd.Start(); err != nil {
			setSyncProgress(dbName, func(s *SyncProgress) {
				s.Running = false
				s.Error = "Gagal menjalankan skrip sinkronisasi: " + err.Error()
				s.Message = "Sinkronisasi gagal"
				s.FinishedAt = time.Now()
			})
			return
		}

		setSyncProgress(dbName, func(s *SyncProgress) {
			s.Message = "Skrip sinkronisasi sedang berjalan..."
		})

		var wg sync.WaitGroup
		consume := func(r io.Reader) {
			defer wg.Done()
			scanner := bufio.NewScanner(r)
			for scanner.Scan() {
				line := strings.TrimSpace(scanner.Text())
				if line == "" {
					continue
				}
				step := detectSyncStep(line)
				setSyncProgress(dbName, func(s *SyncProgress) {
					if step > s.CurrentStep {
						s.CurrentStep = step
						s.Percent = (s.CurrentStep * 100) / s.TotalSteps
					}
					s.Message = line
				})
			}
		}

		wg.Add(2)
		go consume(stdout)
		go consume(stderr)

		err = cmd.Wait()
		wg.Wait()

		if err != nil {
			setSyncProgress(dbName, func(s *SyncProgress) {
				s.Running = false
				s.Error = "Sinkronisasi gagal: " + err.Error()
				s.Message = "Sinkronisasi gagal"
				s.FinishedAt = time.Now()
			})
			return
		}

		setSyncProgress(dbName, func(s *SyncProgress) {
			s.Running = false
			s.CurrentStep = s.TotalSteps
			s.Percent = 100
			s.Message = "Sinkronisasi selesai"
			s.Error = ""
			s.FinishedAt = time.Now()
		})
	}()

	return nil
}

func detectSyncStep(line string) int {
	text := strings.ToLower(line)
	switch {
	case strings.Contains(text, "connected with driver") || strings.Contains(text, "connected with:"):
		return 2
	case strings.Contains(text, "checking available tables"):
		return 3
	case strings.Contains(text, "tables found:"):
		return 3
	case strings.Contains(text, "tables created"):
		return 4
	case strings.Contains(text, "logtrans:") && (strings.Contains(text, "rows processed") || strings.Contains(text, " rows")):
		return 5
	case strings.Contains(text, "logtransline:") && (strings.Contains(text, "rows processed") || strings.Contains(text, " rows")):
		return 6
	case strings.Contains(text, "masteritem:") && (strings.Contains(text, "rows processed") || strings.Contains(text, " rows")):
		return 7
	case strings.Contains(text, "masteritemgroup:") && (strings.Contains(text, "rows processed") || strings.Contains(text, " rows")):
		return 8
	case strings.Contains(text, "mastercostcenter:") && (strings.Contains(text, "rows processed") || strings.Contains(text, " rows")):
		return 9
	case strings.Contains(text, "masterrepresentative:") && (strings.Contains(text, "rows processed") || strings.Contains(text, " rows")):
		return 10
	case strings.Contains(text, "flexnotesetting:") && (strings.Contains(text, "rows processed") || strings.Contains(text, " rows")):
		return 11
	case strings.Contains(text, "migration complete") || strings.Contains(text, " done:"):
		return 12
	default:
		return 0
	}
}

func resolvePythonCommand() (string, []string, error) {
	type candidate struct {
		name    string
		preArgs []string
	}

	candidates := []candidate{
		{name: "python"},
		{name: "python3"},
		{name: "py", preArgs: []string{"-3"}},
		{name: "C:/Program Files/Python312/python.exe"},
	}

	for _, c := range candidates {
		if strings.Contains(c.name, "/") || strings.Contains(c.name, "\\") {
			if _, err := os.Stat(c.name); err == nil {
				return c.name, c.preArgs, nil
			}
			continue
		}

		if resolved, err := exec.LookPath(c.name); err == nil {
			return resolved, c.preArgs, nil
		}
	}

	return "", nil, fmt.Errorf("Python interpreter tidak ditemukan (python/python3/py)")
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

	upperName := strings.ToUpper(dbName)
	sources, err := loadDatabaseSources()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca konfigurasi database: " + err.Error()})
	}

	source, ok := sources[upperName]
	if !ok {
		source = defaultDatabaseSource(upperName)
	}

	targetDatabase := strings.TrimSpace(source.Database)
	if targetDatabase == "" {
		targetDatabase = strings.ToLower(upperName)
	}

	env := map[string]string{
		"DB_DIR":      DBPool.DBDir(),
		"DB_SOURCE_DB": targetDatabase,
	}
	if source.Host != "" {
		env["DB_SOURCE_HOST"] = source.Host
	}
	if source.Username != "" {
		env["DB_SOURCE_USER"] = source.Username
	}
	if source.Password != "" {
		env["DB_SOURCE_PASS"] = source.Password
	}

	script, args := resolveSyncScriptAndArgs(upperName, source)
	log.Printf("Starting async sync for %s using %s %v", strings.ToLower(upperName), script, args)

	if err := startSyncJob(strings.ToLower(upperName), script, args, env); err != nil {
		return c.Status(409).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "Sinkronisasi dimulai untuk " + strings.ToLower(upperName),
		"running": true,
	})
}

func GetSyncStatus(c *fiber.Ctx) error {
	dbName, ok := c.Locals("database").(string)
	if !ok || dbName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Database tidak terpilih"})
	}

	dbName = strings.ToLower(dbName)
	state := getSyncProgress(dbName)
	if state == nil {
		return c.JSON(fiber.Map{
			"database":        strings.ToUpper(dbName),
			"running":         false,
			"percent":         0,
			"current_step":    0,
			"total_steps":     12,
			"remaining_steps": 12,
			"message":         "Belum ada proses sinkronisasi",
		})
	}

	return c.JSON(state)
}
