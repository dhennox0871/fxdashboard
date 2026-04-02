<?php
require_once 'config.php';      // 1. Koneksi
require_once 'data_fetch.php';  // 2. Olah Data
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Salestics - Sales Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
    <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #F9FAFB; color: #1F2937; }
        .sidebar-item.active { background-color: #FF5C35; color: white; box-shadow: 0 10px 15px -3px rgba(255, 92, 53, 0.3); }
        .sidebar-item.inactive { color: #9CA3AF; }
        .sidebar-item.inactive:hover { color: #FF5C35; background-color: #FFF5F3; }
        .card { background: white; border-radius: 20px; border: 1px solid #F3F4F6; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
    </style>
</head>
<body class="flex h-screen overflow-hidden">

    <aside class="w-64 bg-white border-r border-gray-100 flex flex-col h-full py-8 px-6">
		<div class="flex items-center gap-3 mb-10 px-2">
			<div class="bg-[#FF5C35] p-2 rounded-xl">
				<span class="material-symbols-outlined text-white">bolt</span>
			</div>
			<h1 class="text-xl font-bold text-gray-800 tracking-tight">Salestics</h1>
		</div>

		<nav class="space-y-2 flex-1">
			<a href="javascript:void(0)" onclick="showPage('daily')" id="menu-daily" class="sidebar-item active flex items-center gap-4 px-4 py-3 rounded-xl transition-all group">
				<span class="material-symbols-outlined">grid_view</span>
				<span class="font-semibold text-sm">Daily</span>
			</a>
			<a href="javascript:void(0)" onclick="showPage('yearly')" id="menu-yearly" class="sidebar-item inactive flex items-center gap-4 px-4 py-3 rounded-xl transition-all group">
				<span class="material-symbols-outlined">calendar_today</span>
				<span class="font-semibold text-sm">Annually</span>
			</a>
		</nav>

		<div class="mt-auto bg-gray-50 p-4 rounded-2xl flex items-center gap-3">
			<div class="w-10 h-10 rounded-full bg-blue-500 border-2 border-white overflow-hidden">
				<img src="https://ui-avatars.com/api/?name=Admin+Sales&background=0D8ABC&color=fff" alt="avatar">
			</div>
			<div>
				<p class="text-xs font-bold text-gray-800">Rafael Williams</p>
				<p class="text-[10px] text-gray-400 font-medium">Administrator</p>
			</div>
		</div>
	</aside>
<main class="flex-1 flex flex-col h-full overflow-hidden">
    <div id="page-daily" class="page-container h-full overflow-y-auto custom-scrollbar">
        <?php include 'daily_view.php'; ?>
    </div>

    <div id="page-yearly" class="page-container h-full overflow-y-auto custom-scrollbar hidden">
        <?php include 'annually_view.php'; ?>
    </div>
</main>

<script>
function showPage(pageId) {
    // 1. Sembunyikan semua halaman
    document.querySelectorAll('.page-container').forEach(p => p.classList.add('hidden'));
    
    // 2. Tampilkan halaman yang dipilih
    document.getElementById('page-' + pageId).classList.remove('hidden');

    // 3. Reset styling tombol sidebar (menggunakan class yang benar)
    document.querySelectorAll('.sidebar-item').forEach(link => {
        link.classList.remove('active');
        link.classList.add('inactive');
    });

    // 4. Set menu aktif
    const activeMenu = document.getElementById('menu-' + pageId);
    if(activeMenu) {
        activeMenu.classList.add('active');
        activeMenu.classList.remove('inactive');
    }
}
</script>
</body>
</html>