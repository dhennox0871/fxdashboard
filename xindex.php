<?php
// Panggil koneksi dan logika pengambilan data
require_once 'config.php'; 
require_once 'data_fetch.php'; 
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sales Dashboard - SQL Server</title>
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <aside>
            <div class="top">
                <div class="logo">
                    <h2>SALES<span class="danger">PRO</span></h2>
                </div>
            </div>
            <div class="sidebar">
                <a href="#" class="active">
                    <span class="material-symbols-outlined">dashboard</span>
                    <h3>Dashboard</h3>
                </a>
                <a href="#">
                    <span class="material-symbols-outlined">person</span>
                    <h3>Sales Reps</h3>
                </a>
                <a href="#">
                    <span class="material-symbols-outlined">insights</span>
                    <h3>Analytics</h3>
                </a>
                <a href="#">
                    <span class="material-symbols-outlined">settings</span>
                    <h3>Settings</h3>
                </a>
            </div>
        </aside>

        <main>
            <h1>Sales Overview</h1>
            
            <div class="insights">
                <div class="sales">
                    <span class="material-symbols-outlined">analytics</span>
                    <div class="middle">
                        <div class="left">
                            <h3>Total Penjualan</h3>
                            <h1>Rp <?php echo number_format($totalSales, 0, ',', '.'); ?></h1>
                        </div>
                    </div>
                    <small class="text-muted">Update terakhir: Baru saja</small>
                </div>

                <div class="reps">
                    <span class="material-symbols-outlined">leaderboard</span>
                    <div class="middle">
                        <div class="left">
                            <h3>Best Representative</h3>
                            <h1><?php echo $topRep['name'] ?? 'Belum ada data'; ?></h1>
<small class="text-muted">Total: Rp <?php echo number_format($topRep['total_omzet'] ?? 0, 0, ',', '.'); ?></small>
                        </div>
                    </div>
                    <small class="text-muted">Berdasarkan volume bulan ini</small>
                </div>
            </div>

            <div class="charts-container">
                <div class="chart-card">
                    <h2>Tren Penjualan Mingguan</h2>
                    <canvas id="salesChart"></canvas>
                </div>
            </div>

            <div class="recent-orders">
                <h2>Transaksi Terakhir</h2>
                <table>
                    <thead>
                        <tr>
                            <th>ID Transaksi</th>
                            <th>Sales Rep</th>
                            <th>Produk</th>
                            <th>Status</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
						<?php foreach($recentTransactions as $row): ?>
						<tr>
							<td><?php echo $row['logtransentrytext']; ?></td>
							<td><?php echo $row['sales_name']; ?></td>
							<td><?php echo date('d/m/Y', strtotime($row['entrydate'])); ?></td>
							<td class="success">Lunas</td>
							<td>Rp <?php echo number_format($row['grand_total'], 0, ',', '.'); ?></td>
						</tr>
						<?php endforeach; ?>
					</tbody>
                </table>
                <a href="#">Tampilkan Semua</a>
            </div>
        </main>
    </div>

    <script>
        // Inisialisasi Chart sederhana
        const ctx = document.getElementById('salesChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
                datasets: [{
                    label: 'Revenue',
                    data: [12, 19, 3, 5, 2, 3, 9],
                    borderColor: '#7380ec',
                    tension: 0.4
                }]
            }
        });
    </script>
</body>
</html>