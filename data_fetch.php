<?php
// Tangkap input dari filter tanggal di kanan atas
$startDate = $_GET['start'] ?? '2025-06-01';
$endDate   = $_GET['end']   ?? '2025-06-30';
$currentYear = date('Y', strtotime($startDate)); // Mengikuti tahun dari filter start

try {
    $params = [
        'start' => $startDate . ' 00:00:00',
        'end'   => $endDate . ' 23:59:59'
    ];

    // 1. KPI Data: Gunakan ABS() agar hasil SUM selalu positif
    $queryKpi = "SELECT 
                    SUM(ABS(ltl.netvalue + ltl.pajakvalue)) as total_sales, 
                    COUNT(DISTINCT lt.logtransid) as total_orders 
                 FROM logtrans lt
                 JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
                 WHERE lt.entrydate BETWEEN :start AND :end
                 AND lt.transtypeid IN (10, 18)"; // Filter hanya penjualan
    
    $stmtKpi = $conn->prepare($queryKpi);
    $stmtKpi->execute($params);
    $kpi = $stmtKpi->fetch(PDO::FETCH_ASSOC);

    // 2. Top Representative (Positif)
    $queryTopRep = "SELECT TOP 1 r.name, SUM(ABS(ltl.netvalue + ltl.pajakvalue)) as omzet
                    FROM masterrepresentative r
                    JOIN logtrans lt ON r.representativeid = lt.representativeid
                    JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
                    WHERE lt.entrydate BETWEEN :start AND :end
                    AND lt.transtypeid IN (10, 18)
                    GROUP BY r.name ORDER BY omzet DESC";
    $stmtTop = $conn->prepare($queryTopRep);
    $stmtTop->execute($params);
    $topRep = $stmtTop->fetch(PDO::FETCH_ASSOC);

    // 3. Recent Transactions (Positif & Terfilter)
    $queryRecent = "SELECT TOP 10 lt.logtransentrytext, r.name as sales_name, lt.entrydate, 
                    SUM(ABS(ltl.netvalue + ltl.pajakvalue)) as total, lt.transtypeid
                    FROM logtrans lt
                    JOIN masterrepresentative r ON lt.representativeid = r.representativeid
                    JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
                    WHERE lt.entrydate BETWEEN :start AND :end
                    AND lt.transtypeid IN (10, 18)
                    GROUP BY lt.logtransentrytext, r.name, lt.entrydate, lt.transtypeid
                    ORDER BY lt.entrydate DESC";
    $stmtRecent = $conn->prepare($queryRecent);
    $stmtRecent->execute($params);
    $recentTrans = $stmtRecent->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // 4. Chart Data (Positif & Terfilter)
    $queryChart = "SELECT CAST(lt.entrydate AS DATE) as tgl, 
                   SUM(CASE WHEN lt.transtypeid = 18 THEN ABS(ltl.netvalue + ltl.pajakvalue) ELSE 0 END) as tunai,
                   SUM(CASE WHEN lt.transtypeid = 10 THEN ABS(ltl.netvalue + ltl.pajakvalue) ELSE 0 END) as kredit
                   FROM logtrans lt
                   JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
                   WHERE lt.entrydate BETWEEN :start AND :end
                   AND lt.transtypeid IN (10, 18)
                   GROUP BY CAST(lt.entrydate AS DATE) ORDER BY tgl ASC";
    $stmtChart = $conn->prepare($queryChart);
    $stmtChart->execute($params);
    $chartRows = $stmtChart->fetchAll(PDO::FETCH_ASSOC);

    $labels = []; $dataTunai = []; $dataKredit = [];
    foreach($chartRows as $row) {
        $labels[] = date('d M', strtotime($row['tgl']));
        $dataTunai[] = (float)$row['tunai'];
        $dataKredit[] = (float)$row['kredit'];
    }
	
	// --- DATA TAB 2 (PERBANDINGAN TAHUNAN) ---
    $queryYearly = "SELECT 
                        MONTH(lt.entrydate) as bulan, 
                        SUM(ABS(ltl.netvalue + ltl.pajakvalue)) as total 
                    FROM logtrans lt
                    JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
                    WHERE YEAR(lt.entrydate) = :year
                    AND lt.transtypeid IN (10, 18)
                    GROUP BY MONTH(lt.entrydate)
                    ORDER BY bulan ASC";
    
    $stmtYearly = $conn->prepare($queryYearly);
    $stmtYearly->execute(['year' => $currentYear]);
    $yearlyRows = $stmtYearly->fetchAll(PDO::FETCH_ASSOC);

    // Siapkan array 12 bulan agar jika ada bulan kosong tetap tampil 0
    $monthlyLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
    $monthlyData = array_fill(0, 12, 0);

    foreach ($yearlyRows as $row) {
        $monthlyData[$row['bulan'] - 1] = (float)$row['total'];
    }

// Tambahan di data_fetch.php untuk Tab Annually

    // 1. Total Order Tahunan
    $qYearKpi = "SELECT COUNT(DISTINCT lt.logtransid) as total_orders 
                 FROM logtrans lt 
                 WHERE YEAR(lt.entrydate) = :year AND lt.transtypeid IN (10,18)";
    $stYearKpi = $conn->prepare($qYearKpi);
    $stYearKpi->execute(['year' => $currentYear]);
    $yearKpi = $stYearKpi->fetch(PDO::FETCH_ASSOC);

    // 2. Data Distribusi Penjualan (Untuk Pie Chart)
    $qDist = "SELECT r.name, SUM(ABS(ltl.netvalue + ltl.pajakvalue)) as total 
              FROM masterrepresentative r
              JOIN logtrans lt ON r.representativeid = lt.representativeid
              JOIN logtransline ltl ON lt.logtransid = ltl.logtransid
              WHERE YEAR(lt.entrydate) = :year AND lt.transtypeid IN (10,18)
              GROUP BY r.name";
    $stDist = $conn->prepare($qDist);
    $stDist->execute(['year' => $currentYear]);
    $distRows = $stDist->fetchAll(PDO::FETCH_ASSOC);

    $distLabels = []; $distValues = [];
    foreach($distRows as $dr) {
        $distLabels[] = $dr['name'];
        $distValues[] = (float)$dr['total'];
    }

} catch (Exception $e) {
    error_log($e->getMessage());
}