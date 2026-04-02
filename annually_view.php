        <header class="h-20 bg-white/80 backdrop-blur-md flex items-center justify-between px-10 border-b border-gray-50">
            <h2 class="text-xl font-bold text-gray-800">Annual Performance</h2>
            
            <form method="GET" class="flex gap-3">
                <select name="year" class="bg-gray-50 border-none rounded-xl text-sm px-4 py-2 focus:ring-2 focus:ring-[#FF5C35]">
                    <?php for($y=date('Y'); $y>=2024; $y--): ?>
                        <option value="<?=$y?>" <?=$currentYear == $y ? 'selected' : ''?>><?=$y?></option>
                    <?php endfor; ?>
                </select>
                <button class="bg-[#FF5C35] text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-orange-200 hover:scale-105 transition">Filter Year</button>
            </form>
        </header>

        <div class="grid grid-cols-4 gap-6">
			<div class="card p-6">
				<div class="flex justify-between items-start mb-4">
					<div class="p-3 bg-violet-50 rounded-2xl text-violet-500">
						<span class="material-symbols-outlined text-[20px]">payments</span>
					</div>
					<span class="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">+12.5%</span>
				</div>
				<p class="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Annual Revenue</p>
				<h3 class="text-xl font-bold mt-1 text-gray-800">Rp <?= number_format(array_sum($monthlyData), 0, ',', '.') ?></h3>
			</div>

			<div class="card p-6">
				<div class="flex justify-between items-start mb-4">
					<div class="p-3 bg-blue-50 rounded-2xl text-blue-500">
						<span class="material-symbols-outlined text-[20px]">shopping_cart</span>
					</div>
				</div>
				<p class="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Total Orders</p>
				<h3 class="text-xl font-bold mt-1 text-gray-800"><?= number_format($yearKpi['total_orders'] ?? 0, 0, ',', '.') ?></h3>
			</div>

			</div>

		<div class="grid grid-cols-3 gap-8 mt-8">
			<div class="card p-8 col-span-2">
				<h4 class="font-bold text-gray-800 mb-6">Sales Overview <span class="text-gray-400 font-normal ml-2">Last 12 Months</span></h4>
				<div id="annualChartMain"></div>
			</div>

			<div class="card p-8">
				<h4 class="font-bold text-gray-800 mb-6">Sales Distribution</h4>
				<div id="annualDistribution"></div>
				<div class="mt-6 space-y-3">
					<?php foreach(array_slice($distLabels, 0, 4) as $idx => $lab): ?>
					<div class="flex justify-between items-center text-xs">
						<span class="text-gray-500"><?= $lab ?></span>
						<span class="font-bold text-gray-800"><?= number_format(($distValues[$idx]/array_sum($distValues))*100, 1) ?>%</span>
					</div>
					<?php endforeach; ?>
				</div>
			</div>
		</div>
		
<script>
    // Grafik Batang Tahunan ala Salestics
    var optionsAnnual = {
        series: [{ name: 'Earnings', data: <?php echo json_encode($monthlyData); ?> }],
        chart: { type: 'bar', height: 350, toolbar: {show: false}, fontFamily: 'Plus Jakarta Sans' },
        plotOptions: { bar: { borderRadius: 10, columnWidth: '45%', colors: { ranges: [{ from: 0, to: 1000000000, color: '#FF5C35' }] } } },
        dataLabels: { enabled: false },
        xaxis: { categories: <?php echo json_encode($monthlyLabels); ?>, borderDashArray: 0 },
        grid: { borderColor: '#F3F4F6', strokeDashArray: 5, yaxis: { lines: { show: true } } },
        yaxis: { labels: { formatter: (v) => (v / 1000000).toFixed(0) + "M" } }
    };
    new ApexCharts(document.querySelector("#annualChartMain"), optionsAnnual).render();
	
	// Script untuk Sales Distribution (Pie Chart)
var optionsDist = {
    series: <?php echo json_encode($distValues); ?>,
    chart: { type: 'donut', height: 250, fontFamily: 'Plus Jakarta Sans' },
    labels: <?php echo json_encode($distLabels); ?>,
    colors: ['#FF5C35', '#7C3AED', '#3B82F6', '#10B981', '#F59E0B'],
    legend: { show: false },
    plotOptions: { pie: { donut: { size: '75%' } } },
    dataLabels: { enabled: false }
};
new ApexCharts(document.querySelector("#annualDistribution"), optionsDist).render();
</script>