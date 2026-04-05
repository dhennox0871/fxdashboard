import React, { useState } from 'react';
import { Box, Typography, Button, Paper, Alert, CircularProgress, Divider } from '@mui/material';
import Sync from '@mui/icons-material/Sync';
import CloudDownload from '@mui/icons-material/CloudDownload';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Warning from '@mui/icons-material/Warning';
import { useAuth } from '../context/AuthContext';

export default function SyncPage() {
  const { fetchWithAuth, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/settings/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal sinkronisasi');
      setResult(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Sinkronisasi Data</Typography>
        <Typography variant="body2" color="textSecondary">Perbarui data SQLite lokal dengan data terbaru dari SQL Server</Typography>
      </Box>

      <Paper sx={{ p: 4, borderRadius: 3, maxWidth: 600, mx: 'auto', textAlign: 'center' }}>
        <Sync sx={{ fontSize: 60, color: '#b66dff', mb: 2, animation: loading ? 'spin 2s linear infinite' : 'none', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
        
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
          Database Aktif: <span style={{ color: '#b66dff' }}>{user?.database || '-'}</span>
        </Typography>
        
        <Typography variant="body2" color="textSecondary" sx={{ mb: 4 }}>
          Tindakan ini akan menjalankan skrip migrasi di server untuk mengambil transaksi terbaru dari SQL Server. Proses ini mungkin memakan waktu beberapa detik hingga satu menit tergantung volume data.
        </Typography>

        <Button
          variant="contained"
          size="large"
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CloudDownload />}
          disabled={loading}
          onClick={handleSync}
          sx={{
            py: 1.5, px: 4, borderRadius: 10, fontWeight: 'bold',
            background: 'linear-gradient(135deg, #da8cff 0%, #9a55ff 100%)',
            boxShadow: '0 8px 20px rgba(154, 85, 255, 0.3)',
            '&:hover': { background: 'linear-gradient(135deg, #cc7ef0 0%, #8b48e3 100%)' }
          }}
        >
          {loading ? 'Sedang Menyinkronkan...' : 'Mulai Sinkronisasi Sekarang'}
        </Button>

        {result && (
          <Alert severity="success" icon={<CheckCircle />} sx={{ mt: 4, borderRadius: 2 }}>
            {result}
          </Alert>
        )}

        {error && (
          <Alert severity="error" icon={<Warning />} sx={{ mt: 4, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        <Divider sx={{ my: 4 }} />
        <Typography variant="caption" color="textSecondary">
          Pastikan server dashboard memiliki konektivitas ODBC ke database SQL Server tujuan.
        </Typography>
      </Paper>
    </Box>
  );
}
