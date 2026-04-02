<?php
$serverName = "cstde";
$database = "kbrsbw3";
$uid = "fxadmin18";
$pwd = "r3startsaja";

try {
    // Tambahkan TrustServerCertificate agar tidak error SSL
    $conn = new PDO("sqlsrv:server=$serverName;Database=$database;TrustServerCertificate=1", $uid, $pwd);
    
    // Perbaikan Typo: Hilangkan satu kata 'ERR' di sini
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
} catch(PDOException $e) {
    die("Koneksi Gagal: " . $e->getMessage());
}
?>