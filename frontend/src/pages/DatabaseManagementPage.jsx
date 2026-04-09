import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import Storage from '@mui/icons-material/Storage';
import Save from '@mui/icons-material/Save';
import CloudDownload from '@mui/icons-material/CloudDownload';
import Refresh from '@mui/icons-material/Refresh';
import Edit from '@mui/icons-material/Edit';
import Add from '@mui/icons-material/Add';
import { useAuth } from '../context/AuthContext';

function emptySource(name = '') {
  return {
    name,
    host: '',
    database: name ? name.toLowerCase() : '',
    username: '',
    password: '',
    script: '',
    mode: 'incremental',
    enabled: true,
  };
}

export default function DatabaseManagementPage() {
  const { fetchWithAuth } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [form, setForm] = useState(emptySource());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadItems = async () => {
    const res = await fetchWithAuth('/api/settings/databases');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal membaca daftar database');
    setItems(data.items || []);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadItems();
      } catch (err) {
        setError(err.message || 'Terjadi kesalahan');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const hasRunning = items.some((it) => it.running);
    if (!hasRunning) return;

    const timer = setInterval(() => {
      loadItems().catch(() => {});
    }, 1500);

    return () => clearInterval(timer);
  }, [items]);

  const openNewEditor = () => {
    setEditingName('');
    setForm(emptySource());
    setEditorOpen(true);
    setError('');
    setSuccess('');
  };

  const openEditEditor = (item) => {
    setEditingName(item.name);
    setForm({ ...emptySource(item.name), ...item.source, name: item.name });
    setEditorOpen(true);
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: (form.name || '').toUpperCase(),
        mode: form.mode || 'incremental',
        enabled: form.enabled !== false,
      };
      const res = await fetchWithAuth('/api/settings/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan konfigurasi');

      setSuccess('Konfigurasi database berhasil disimpan');
      await loadItems();
      setEditingName(payload.name);
    } catch (err) {
      setError(err.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    const targetName = (form.name || editingName || '').toUpperCase();
    if (!targetName) {
      setError('Pilih atau isi nama database terlebih dahulu');
      return;
    }

    setError('');
    setSuccess('');
    setSyncing(true);
    try {
      const res = await fetchWithAuth(`/api/settings/databases/${targetName}/sync`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memulai sinkronisasi');

      setSuccess(data.message || `Sinkronisasi dimulai untuk ${targetName}`);
      await loadItems();
      setEditingName(targetName);
    } catch (err) {
      setError(err.message || 'Gagal sinkronisasi');
    } finally {
      setSyncing(false);
    }
  };

  const handleQuickSync = async (name) => {
    const targetName = (name || '').toUpperCase();
    if (!targetName) return;

    setError('');
    setSuccess('');
    setSyncing(true);
    try {
      const res = await fetchWithAuth(`/api/settings/databases/${targetName}/sync`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memulai sinkronisasi');

      setSuccess(data.message || `Sinkronisasi dimulai untuk ${targetName}`);
      await loadItems();
    } catch (err) {
      setError(err.message || 'Gagal sinkronisasi');
    } finally {
      setSyncing(false);
    }
  };

  const isConfigComplete = (source) => {
    return !!(
      source &&
      source.host &&
      source.database &&
      source.username &&
      source.password
    );
  };

  const handleToggleDashboardStatus = async (item) => {
    setError('');
    setSuccess('');
    try {
      const nextEnabled = !item.source?.enabled;
      const res = await fetchWithAuth(`/api/settings/databases/${item.name}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status database');

      setSuccess(data.message || `Status ${item.name} berhasil diubah`);
      await loadItems();
    } catch (err) {
      setError(err.message || 'Gagal mengubah status');
    }
  };

  const editingItem = items.find((it) => it.name === (form.name || editingName));

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Database Management</Typography>
        <Typography variant="body2" color="text.secondary">
          Kelola daftar database, konfigurasi koneksi SQL Server, dan proses download/create SQLite.
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <Button variant="outlined" startIcon={<Refresh />} onClick={() => loadItems()}>
          Refresh
        </Button>
        <Button variant="contained" startIcon={<Add />} onClick={openNewEditor}>
          Tambah Database Baru
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Database</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>SQLite File</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status SQLite</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Config</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Dashboard</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Sinkronisasi</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Aksi</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.name} hover>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Storage fontSize="small" color={item.has_sqlite ? 'success' : 'disabled'} />
                    <Typography sx={{ fontWeight: 700 }}>{item.name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>{item.filename}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={item.has_sqlite ? 'success' : 'default'}
                    label={item.has_sqlite ? 'SQLite OK' : 'Belum Ada'}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={item.source.host ? 'info' : 'default'}
                    label={item.source.host ? 'Tersedia' : 'Belum'}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant={item.source?.enabled === false ? 'outlined' : 'contained'}
                    size="small"
                    color={item.source?.enabled === false ? 'inherit' : 'success'}
                    onClick={() => handleToggleDashboardStatus(item)}
                  >
                    {item.source?.enabled === false ? 'OFF' : 'ON'}
                  </Button>
                </TableCell>
                <TableCell>
                  {item.running ? (
                    <Chip size="small" color="warning" label="Syncing" />
                  ) : item.last_sync ? (
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                      Terakhir: {item.last_sync}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.disabled">
                      Belum pernah
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      variant="contained"
                      size="small"
                      color="secondary"
                      startIcon={syncing ? <CircularProgress size={14} color="inherit" /> : <CloudDownload />}
                      disabled={syncing || item.running || !isConfigComplete(item.source)}
                      onClick={() => handleQuickSync(item.name)}
                    >
                      Sinkron
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Edit />}
                      onClick={() => openEditEditor(item)}
                    >
                      Edit
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editingName ? `Edit Konfigurasi ${editingName}` : 'Tambah Database Baru'}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Informasi konfigurasi dan pilihan sinkronisasi ditampilkan setelah tombol Edit dibuka.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nama Database"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value.toUpperCase() }))}
                fullWidth
                placeholder="Contoh: OSLANK"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nama DB di SQL Server"
                value={form.database}
                onChange={(e) => setForm((prev) => ({ ...prev, database: e.target.value }))}
                fullWidth
                placeholder="Contoh: oslank"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Host SQL Server"
                value={form.host}
                onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))}
                fullWidth
                placeholder="Contoh: idtemp.flexnotesuite.com,18180"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Username"
                value={form.username}
                onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Script"
                value={form.script}
                onChange={(e) => setForm((prev) => ({ ...prev, script: e.target.value }))}
                fullWidth
                placeholder="migrate_base.py"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Mode"
                value={form.mode}
                onChange={(e) => setForm((prev) => ({ ...prev, mode: e.target.value }))}
                fullWidth
                placeholder="incremental / full"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Tampilkan di Dashboard"
                value={form.enabled === false ? 'off' : 'on'}
                onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.value === 'on' }))}
                fullWidth
              >
                <MenuItem value="on">ON</MenuItem>
                <MenuItem value="off">OFF</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setEditorOpen(false)}>
            Tutup
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />}
            onClick={handleSave}
            disabled={saving}
          >
            Simpan Konfigurasi
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={syncing ? <CircularProgress size={18} color="inherit" /> : <CloudDownload />}
            onClick={handleSync}
            disabled={syncing || !!editingItem?.running}
          >
            Jalankan Sinkronisasi
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
