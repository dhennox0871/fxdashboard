<header class="h-20 bg-white/80 backdrop-blur-md flex items-center justify-between px-10 border-b border-gray-50 sticky top-0 z-10">
    <h2 class="text-xl font-bold text-gray-800">Daily Sales Overview</h2>
    
    <form method="GET" class="flex items-center gap-3">
        <div class="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl">
            <input type="date" name="start" value="<?= $startDate ?>" class="bg-transparent border-none text-sm focus:ring-0">
            <span class="text-gray-400">to</span>
            <input type="date" name="end" value="<?= $endDate ?>" class="bg-transparent border-none text-sm focus:ring-0">
        </div>
        <button type="submit" class="bg-[#FF5C35] text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md hover:scale-105 transition">
            Apply
        </button>
    </form>
</header>

<main class="flex-1 flex flex-col h-full overflow-hidden">
        <div class="p-8 space-y-6 overflow-y-auto h-full custom-scrollbar">
            
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
					<p class="text-slate-500 text-sm">Total Revenue</p>
					<h3 class="text-2xl font-bold mt-1 text-slate-800">
						Rp <?php echo number_format($kpi['total_sales'] ?? 0, 0, ',', '.'); ?>
					</h3>
					<span class="text-emerald-500 text-xs font-medium">Periode Terpilih</span>
				</div>

				<div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
					<p class="text-slate-500 text-sm">Total Orders</p>
					<h3 class="text-2xl font-bold mt-1 text-slate-800">
						<?php echo number_format($kpi['total_orders'] ?? 0, 0, ',', '.'); ?>
					</h3>
					<span class="text-slate-400 text-xs font-medium tracking-wide">Transaksi</span>
				</div>

				<div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
					<p class="text-slate-500 text-sm">Top Sales Rep</p>
					<h3 class="text-xl font-bold mt-1 text-slate-800">
						<?php echo $topRep['name'] ?? 'Tidak ada data'; ?>
					</h3>
					<span class="text-emerald-600 text-xs font-semibold">
						Rp <?php echo number_format($topRep['omzet'] ?? 0, 0, ',', '.'); ?>
					</span>
				</div>
                
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-96">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="font-bold text-slate-800">Revenue Analysis</h4>
                        <div class="flex space-x-2">
                            <span class="flex items-center text-xs text-slate-500"><span class="w-3 h-3 bg-emerald-500 rounded-full mr-1"></span> Tunai</span>
                            <span class="flex items-center text-xs text-slate-500"><span class="w-3 h-3 bg-blue-500 rounded-full mr-1"></span> Kredit</span>
                        </div>
                    </div>
                    <div id="mainChart"></div>
                </div>

                <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-96">
                    <h4 class="font-bold text-slate-800 mb-4">Recent Transactions</h4>
                    <div class="flex-1 overflow-y-auto custom-scrollbar space-y-4 text-sm">
                        <?php foreach($recentTrans as $row): ?>
							<div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition">
								<div>
									<p class="font-semibold text-slate-700"><?php echo htmlspecialchars($row['logtransentrytext']); ?></p>
									<p class="text-xs text-slate-400"><?php echo htmlspecialchars($row['sales_name']); ?> • <?php echo date('d M', strtotime($row['entrydate'])); ?></p>
								</div>
								<div class="text-right">
									<p class="font-bold text-slate-800">Rp <?php echo number_format($row['total'], 0, ',', '.'); ?></p>
									<span class="text-[10px] px-2 py-0.5 <?php echo $row['transtypeid'] == 18 ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'; ?> rounded-full uppercase">
										<?php echo $row['transtypeid'] == 18 ? 'Tunai' : 'Kredit'; ?>
									</span>
								</div>
							</div>
						<?php endforeach; ?>
                    </div>
                </div>
            </div>

        </div>
    </main>

    <script>
        // Konfigurasi Chart Modern
        var options = {
			series: [{
				name: 'Tunai',
				data: <?php echo json_encode($dataTunai ?: [0]); ?> // Kasih [0] jika kosong agar grafik tidak hang
			}, {
				name: 'Kredit',
				data: <?php echo json_encode($dataKredit ?: [0]); ?>
			}],
			chart: { height: 300, type: 'area', toolbar: { show: false }, fontFamily: 'Inter' },
			colors: ['#10b981', '#3b82f6'],
			xaxis: { 
				categories: <?php echo json_encode($labels ?: [date('d M')]); ?> 
			},
            chart: { height: 300, type: 'area', toolbar: { show: false }, fontFamily: 'Inter' },
            colors: ['#10b981', '#3b82f6'],
            dataLabels: { enabled: false },
            stroke: { curve: 'smooth', width: 2 },
            grid: { borderColor: '#f1f5f9' },
            xaxis: { categories: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.0, stops: [0, 90, 100] } }
        };

        var chart = new ApexCharts(document.querySelector("#mainChart"), options);
        chart.render();
    </script>