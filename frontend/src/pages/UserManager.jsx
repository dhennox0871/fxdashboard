import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Alert, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import Edit from '@mui/icons-material/Edit';
import PersonAdd from '@mui/icons-material/PersonAdd';
import { useAuth } from '../context/AuthContext';

export default function UserManager() {
  const { fetchWithAuth, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [formData, setFormData] = useState({ username: '', password: '', role: 'user' });
  const [resetData, setResetData] = useState({ password: '' });

  const fetchUsers = async () => {
    try {
      const res = await fetchWithAuth('/api/manager/users');
      const data = await res.json();
      if (res.ok) setUsers(data || []);
    } catch (err) {
      setError('Gagal mengambil data user');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentUser?.database]); // Refetch if DB changes

  const handleAdd = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/manager/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpen(false);
      setFormData({ username: '', password: '', role: 'user' });
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/manager/users/${selectedUser.username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resetData)
      });
      if (!res.ok) throw new Error('Gagal reset password');
      setResetOpen(false);
      setResetData({ password: '' });
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>User Manager</Typography>
          <Typography variant="body2" color="textSecondary">Kelola pengguna untuk database: <b>{currentUser?.database}</b></Typography>
        </Box>
        <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setOpen(true)} sx={{ borderRadius: 10, bgcolor: '#ffab00', '&:hover': { bgcolor: '#e69a00' } }}>
          Tambah User
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f8f9fa' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Username</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Role</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Password</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">Aksi</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((row) => (
              <TableRow key={row.username}>
                <TableCell sx={{ fontWeight: 'bold' }}>{row.username}</TableCell>
                <TableCell>{row.role}</TableCell>
                <TableCell>******</TableCell>
                <TableCell align="right">
                  <Button size="small" startIcon={<Edit />} onClick={() => { setSelectedUser(row); setResetOpen(true); }}>
                    Reset Pass
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add User Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Tambah User Baru</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Username" fullWidth value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} />
            <TextField label="Password" type="password" fullWidth value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select label="Role" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="user">User</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpen(false)}>Batal</Button>
          <Button variant="contained" onClick={handleAdd} disabled={loading} sx={{ bgcolor: '#ffab00', '&:hover': { bgcolor: '#e69a00' } }}>
            Simpan User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Reset Password: {selectedUser?.username}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Password Baru" type="text" fullWidth value={resetData.password} onChange={(e) => setResetData({...resetData, password: e.target.value})} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setResetOpen(false)}>Batal</Button>
          <Button variant="contained" onClick={handleResetPassword} disabled={loading} sx={{ bgcolor: '#ffab00', '&:hover': { bgcolor: '#e69a00' } }}>
            Update Password
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
