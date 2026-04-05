import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Alert } from '@mui/material';
import Delete from '@mui/icons-material/Delete';
import Add from '@mui/icons-material/Add';
import { useAuth } from '../context/AuthContext';

export default function DatabaseManager() {
  const { fetchWithAuth } = useAuth();
  const [connections, setConnections] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({ name: '', host: '', db_name: '', username: '', password: '', driver: 'ODBC Driver 17 for SQL Server' });

  const fetchConnections = async () => {
    try {
      const res = await fetchWithAuth('/api/manager/connections');
      const data = await res.json();
      if (res.ok) setConnections(data || []);
    } catch (err) {
      setError('Gagal mengambil data koneksi');
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleAdd = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/manager/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpen(false);
      setFormData({ name: '', host: '', db_name: '', username: '', password: '', driver: 'ODBC Driver 17 for SQL Server' });
      fetchConnections();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus koneksi ini?')) return;
    try {
      await fetchWithAuth(`/api/manager/connections/${id}`, { method: 'DELETE' });
      fetchConnections();
    } catch (err) {
      setError('Gagal menghapus koneksi');
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Database Manager</Typography>
          <Typography variant="body2" color="textSecondary">Kelola koneksi server SQL Server untuk setiap client</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)} sx={{ borderRadius: 10, bgcolor: '#ffab00', '&:hover': { bgcolor: '#e69a00' } }}>
          Tambah Database
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f8f9fa' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Nama (ID Logo)</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Host Server</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Database</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>User SQL</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">Aksi</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {connections.map((row) => (
              <TableRow key={row.id}>
                <TableCell sx={{ fontWeight: 'bold', color: '#ffab00' }}>{row.name}</TableCell>
                <TableCell>{row.host}</TableCell>
                <TableCell>{row.db_name}</TableCell>
                <TableCell>{row.username}</TableCell>
                <TableCell align="right">
                  <IconButton color="error" onClick={() => handleDelete(row.id)}><Delete /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {connections.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>Belum ada data koneksi</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Tambah Koneksi Baru</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Nama Tampilan (Contoh: OSLSRG)" fullWidth value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            <TextField label="Host (Contoh: server.com,18180)" fullWidth value={formData.host} onChange={(e) => setFormData({...formData, host: e.target.value})} />
            <TextField label="Nama Database SQL" fullWidth value={formData.db_name} onChange={(e) => setFormData({...formData, db_name: e.target.value})} />
            <TextField label="Username SQL" fullWidth value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} />
            <TextField label="Password SQL" type="password" fullWidth value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
            <TextField label="ODBC Driver" fullWidth value={formData.driver} onChange={(e) => setFormData({...formData, driver: e.target.value})} helperText="Default: ODBC Driver 17 for SQL Server" />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpen(false)}>Batal</Button>
          <Button variant="contained" onClick={handleAdd} disabled={loading} sx={{ bgcolor: '#ffab00', '&:hover': { bgcolor: '#e69a00' } }}>
            {loading ? 'Menyimpan...' : 'Simpan Koneksi'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
