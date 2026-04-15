import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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
import { useAuth } from '../context/AuthContext';

const menuOptions = [
  { key: 'daily', label: 'Daily View' },
  { key: 'annually', label: 'Annually View' },
  { key: 'bi-planning', label: 'BI Dashboard' },
  { key: 'settings', label: 'Appearance Settings' },
  { key: 'sync', label: 'Synchronize Data' },
  { key: 'manage-users', label: 'Manage User' },
];

export default function ManageUsersPage() {
  const { fetchWithAuth, user } = useAuth();
  const isMasterAdmin = !!user?.is_masteradmin;
  const isSuperAdmin = user?.role === 'superadmin';
  const canManageUsers = isMasterAdmin || isSuperAdmin;

  const [databaseOptions, setDatabaseOptions] = useState([]);
  const [selectedDatabase, setSelectedDatabase] = useState('');

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'admin' });
  const [newUserMenus, setNewUserMenus] = useState(['daily', 'annually', 'bi-planning', 'settings', 'sync', 'manage-users']);
  const [menuDrafts, setMenuDrafts] = useState({});
  const [resetPasswords, setResetPasswords] = useState({});
  const [menuEditorUser, setMenuEditorUser] = useState(null);
  const [menuEditorDraft, setMenuEditorDraft] = useState([]);

  const [ownPassword, setOwnPassword] = useState({ old_password: '', new_password: '' });

  const normalizeList = (value) => (Array.isArray(value) ? value : []);

  const withDatabaseQuery = (basePath) => {
    if (!isSuperAdmin) return basePath;
    const db = (selectedDatabase || '').trim();
    if (!db) return basePath;
    const separator = basePath.includes('?') ? '&' : '?';
    return `${basePath}${separator}database=${encodeURIComponent(db)}`;
  };

  const loadDatabaseOptions = async () => {
    if (!isSuperAdmin) {
      setDatabaseOptions([]);
      setSelectedDatabase(user?.database || '');
      return;
    }
    try {
      const res = await fetchWithAuth('/api/users/databases');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat database');
      const rows = normalizeList(data.rows);
      setDatabaseOptions(rows);
      if (!selectedDatabase && rows.length > 0) {
        setSelectedDatabase(rows[0].name || rows[0].Name || '');
      }
    } catch (err) {
      setError(err.message || 'Gagal memuat database');
    }
  };

  const loadUsers = async () => {
    if (isSuperAdmin && !selectedDatabase) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth(withDatabaseQuery('/api/users'));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data user');
      const rows = normalizeList(data.users);
      setUsers(rows);
      const drafts = {};
      rows.forEach((u) => {
        drafts[u.username] = normalizeList(u.menu_access);
      });
      setMenuDrafts(drafts);
    } catch (err) {
      setError(err.message || 'Gagal memuat data user');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabaseOptions();
  }, [isSuperAdmin]);

  useEffect(() => {
    loadUsers();
  }, [selectedDatabase, isSuperAdmin]);

  const myProfile = useMemo(() => {
    const uname = (user?.username || '').toLowerCase();
    return users.find((u) => (u.username || '').toLowerCase() === uname);
  }, [users, user]);

  const toggleListValue = (list, key) => {
    if (list.includes(key)) return list.filter((v) => v !== key);
    return [...list, key];
  };

  const handleCreateUser = async () => {
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth(withDatabaseQuery('/api/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newUser, menu_access: newUserMenus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah user');
      setSuccess('User baru berhasil ditambahkan.');
      setNewUser({ username: '', password: '', role: 'admin' });
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Gagal menambah user');
    }
  };

  const handleSaveMenus = async (username, menuAccessOverride = null) => {
    setError('');
    setSuccess('');
    const menuAccess = menuAccessOverride == null ? normalizeList(menuDrafts[username]) : normalizeList(menuAccessOverride);
    try {
      const res = await fetchWithAuth(withDatabaseQuery(`/api/users/${encodeURIComponent(username)}/menus`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu_access: menuAccess }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan menu user');
      setSuccess(`Menu user ${username} berhasil diperbarui.`);
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan menu user');
    }
  };

  const handleResetPassword = async (username) => {
    const newPass = (resetPasswords[username] || '').trim();
    if (!newPass) {
      setError(`Isi password baru untuk ${username}.`);
      return;
    }
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth(withDatabaseQuery(`/api/users/${encodeURIComponent(username)}/reset-password`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal reset password');
      setSuccess(`Password user ${username} berhasil direset.`);
      setResetPasswords((prev) => ({ ...prev, [username]: '' }));
    } catch (err) {
      setError(err.message || 'Gagal reset password');
    }
  };

  const handleDeleteUser = async (username) => {
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth(withDatabaseQuery(`/api/users/${encodeURIComponent(username)}`), {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus user');
      setSuccess(`User ${username} berhasil dihapus.`);
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Gagal menghapus user');
    }
  };

  const handleChangeOwnPassword = async () => {
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth(withDatabaseQuery('/api/users/change-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ownPassword),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal ganti password');
      setSuccess('Password Anda berhasil diubah.');
      setOwnPassword({ old_password: '', new_password: '' });
    } catch (err) {
      setError(err.message || 'Gagal ganti password');
    }
  };

  const summarizeMenus = (menu) => {
    const list = normalizeList(menu);
    if (list.length === 0) return 'Tidak ada menu aktif';
    const labels = menuOptions
      .filter((opt) => list.includes(opt.key))
      .map((opt) => opt.label);
    if (labels.length <= 2) return labels.join(', ');
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2} lagi`;
  };

  const openMenuEditor = (username) => {
    setMenuEditorUser(username);
    setMenuEditorDraft(normalizeList(menuDrafts[username]));
  };

  const handleSaveMenuEditor = async () => {
    if (!menuEditorUser) return;
    await handleSaveMenus(menuEditorUser, menuEditorDraft);
    setMenuEditorUser(null);
  };

  return (
    <Box>
      <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Manage User</Typography>
        <Typography variant="body2" color="text.secondary">
          {isSuperAdmin
            ? 'Superadmin dapat mengatur user untuk semua database. Pilih database target terlebih dahulu.'
            : isMasterAdmin
            ? 'Masteradmin dapat menambah user, reset password, hapus user, dan atur menu akses.'
            : 'Halaman ini hanya untuk mengganti password akun Anda.'}
        </Typography>
        {isSuperAdmin && (
          <Box sx={{ mt: 1.5 }}>
            <TextField
              select
              size="small"
              label="Database Target"
              value={selectedDatabase}
              onChange={(e) => setSelectedDatabase(e.target.value)}
              sx={{ minWidth: 280 }}
            >
              {databaseOptions.map((db) => {
                const name = db.name || db.Name;
                return <MenuItem key={name} value={name}>{name}</MenuItem>;
              })}
            </TextField>
          </Box>
        )}
      </Paper>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {!isSuperAdmin && (
        <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Ganti Password Saya</Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                type="password"
                label="Password Lama"
                value={ownPassword.old_password}
                onChange={(e) => setOwnPassword((prev) => ({ ...prev, old_password: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                type="password"
                label="Password Baru"
                value={ownPassword.new_password}
                onChange={(e) => setOwnPassword((prev) => ({ ...prev, new_password: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button variant="contained" onClick={handleChangeOwnPassword}>Simpan Password</Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {canManageUsers && (
        <>
          <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Tambah User Baru</Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Username"
                  value={newUser.username}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, username: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="password"
                  label="Password"
                  value={newUser.password}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  select
                  size="small"
                  label="Role"
                  value={newUser.role}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <MenuItem value="admin">admin</MenuItem>
                  <MenuItem value="user">user</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <Button variant="contained" onClick={handleCreateUser}>Tambah User</Button>
              </Grid>
            </Grid>

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Menu Akses User Baru</Typography>
            <Grid container>
              {menuOptions.map((opt) => (
                <Grid item xs={12} sm={6} md={4} key={opt.key}>
                  <FormControlLabel
                    control={(
                      <Checkbox
                        checked={newUserMenus.includes(opt.key)}
                        onChange={() => setNewUserMenus((prev) => toggleListValue(prev, opt.key))}
                      />
                    )}
                    label={opt.label}
                  />
                </Grid>
              ))}
            </Grid>
          </Paper>

          <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Daftar User</Typography>
            {loading ? (
              <Typography variant="body2" color="text.secondary">Memuat data user...</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Username</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Menu Akses</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Reset Password</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Aksi</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" color="text.secondary">Belum ada user pada database ini.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((row) => {
                        const isMasterRow = !!row.is_masteradmin;
                        return (
                          <TableRow key={row.username} hover>
                            <TableCell>{row.username}</TableCell>
                            <TableCell>{row.role}{isMasterRow ? ' (masteradmin)' : ''}</TableCell>
                            <TableCell>
                              {isMasterRow ? (
                                <Typography variant="body2" color="text.secondary">Semua menu aktif</Typography>
                              ) : (
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="body2" color="text.secondary">{summarizeMenus(menuDrafts[row.username])}</Typography>
                                  <Button size="small" variant="text" onClick={() => openMenuEditor(row.username)}>Atur Menu</Button>
                                </Stack>
                              )}
                            </TableCell>
                            <TableCell>
                              {isMasterRow ? (
                                <Typography variant="body2" color="text.secondary">Tidak tersedia</Typography>
                              ) : (
                                <Stack direction="row" spacing={1}>
                                  <TextField
                                    size="small"
                                    type="password"
                                    placeholder="Password baru"
                                    value={resetPasswords[row.username] || ''}
                                    onChange={(e) => setResetPasswords((prev) => ({ ...prev, [row.username]: e.target.value }))}
                                  />
                                  <Button size="small" variant="outlined" onClick={() => handleResetPassword(row.username)}>Reset</Button>
                                </Stack>
                              )}
                            </TableCell>
                            <TableCell>
                              {isMasterRow ? (
                                <Typography variant="body2" color="text.secondary">Tidak tersedia</Typography>
                              ) : (
                                <Button size="small" color="error" variant="outlined" onClick={() => handleDeleteUser(row.username)}>
                                  Hapus
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </>
      )}

      {!isMasterAdmin && myProfile && (
        <Paper sx={{ p: 2.5, borderRadius: 2.5, mt: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Menu Anda</Typography>
          <Typography variant="body2" color="text.secondary">
            {normalizeList(myProfile.menu_access).join(', ') || 'Belum ada menu aktif'}
          </Typography>
        </Paper>
      )}

      <Dialog open={!!menuEditorUser} onClose={() => setMenuEditorUser(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Atur Menu User {menuEditorUser || ''}</DialogTitle>
        <DialogContent dividers>
          <Grid container>
            {menuOptions.map((opt) => (
              <Grid item xs={12} sm={6} key={`editor-${opt.key}`}>
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={menuEditorDraft.includes(opt.key)}
                      onChange={() => setMenuEditorDraft((prev) => toggleListValue(prev, opt.key))}
                    />
                  )}
                  label={opt.label}
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMenuEditorUser(null)}>Batal</Button>
          <Button variant="contained" onClick={handleSaveMenuEditor}>Simpan Menu</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
