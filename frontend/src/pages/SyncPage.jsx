import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, Paper, Alert, CircularProgress, Divider, LinearProgress } from '@mui/material';
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
  const [progress, setProgress] = useState({
    running: false,
    percent: 0,
    current_step: 0,
    total_steps: 12,
    remaining_steps: 12,
    message: '',
  });
  const pollRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const fetchSyncStatus = async () => {
    const res = await fetchWithAuth('/api/settings/sync-status');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal membaca status sinkronisasi');
    setProgress(data);
    return data;
  };

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const status = await fetchSyncStatus();
        if (!status.running) {
          stopPolling();
          setLoading(false);
          if (status.error) {
            setError(status.error);
          } else {
            setResult(status.message || 'Sinkronisasi selesai');
          }
        }
      } catch (err) {
        stopPolling();
        setLoading(false);
        setError(err.message);
      }
    }, 1200);
  };

  useEffect(() => {
    (async () => {
      try {
        const status = await fetchSyncStatus();
        if (status.running) {
          setLoading(true);
          startPolling();
        }
      } catch (_) {
        // ignore initial status errors to keep page usable
      }
    })();

    return () => stopPolling();
  }, []);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/settings/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal sinkronisasi');

      const status = await fetchSyncStatus();
      if (status.running) {
        startPolling();
      } else {
        setLoading(false);
        setResult(data.message || 'Sinkronisasi selesai');
      }
    } catch (err) {
      setError(err.message);
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

        {loading && (
          <Box sx={{ mb: 3, textAlign: 'left' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#7f46d8' }}>
                Progress sinkronisasi: {progress.percent || 0}%
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {progress.current_step || 0}/{progress.total_steps || 12} langkah
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.max(0, Math.min(100, progress.percent || 0))}
              sx={{
                height: 10,
                borderRadius: 10,
                backgroundColor: 'rgba(154, 85, 255, 0.15)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #da8cff 0%, #9a55ff 100%)',
                },
              }}
            />
            <Typography variant="caption" sx={{ display: 'block', mt: 0.8, color: 'text.secondary' }}>
              {progress.message || 'Menyiapkan proses...'}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: '#8b48e3', fontWeight: 600 }}>
              Sisa langkah: {progress.remaining_steps ?? 0}
            </Typography>
          </Box>
        )}

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
