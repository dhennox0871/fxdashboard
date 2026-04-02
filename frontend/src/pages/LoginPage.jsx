import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Paper, Alert, CircularProgress, MenuItem } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('');
  const [databases, setDatabases] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDb, setLoadingDb] = useState(true);

  useEffect(() => {
    fetch('/api/databases')
      .then(r => r.json())
      .then(data => {
        setDatabases(data || []);
        if (data && data.length === 1) setDatabase(data[0].name);
      })
      .catch(() => setError('Gagal terhubung ke server'))
      .finally(() => setLoadingDb(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password, database);
      navigate('/daily');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <Box sx={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', top: -80, left: -80 }} />
      <Box sx={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', bottom: -40, right: -40 }} />
      <Box sx={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', top: '40%', right: '15%' }} />

      <Paper
        elevation={24}
        sx={{
          p: 5,
          borderRadius: 4,
          width: 420,
          maxWidth: '90vw',
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(255,255,255,0.95)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <img src="/logo.png" alt="Flexnote Logo" style={{ width: 48, height: 48, marginBottom: 12, borderRadius: 10 }} />
          <Typography variant="h5" sx={{ fontWeight: 900, color: '#764ba2', letterSpacing: '-0.5px' }}>
            Flexnote Suites
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
            Masuk ke Dashboard
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <TextField
            select
            label="Database"
            fullWidth
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            sx={{ mb: 2.5 }}
            variant="outlined"
            disabled={loadingDb}
            helperText={loadingDb ? 'Memuat daftar database...' : databases.length === 0 ? 'Tidak ada database ditemukan' : ''}
          >
            {databases.map((db) => (
              <MenuItem key={db.name} value={db.name}>
                {db.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Username"
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            sx={{ mb: 2.5 }}
            variant="outlined"
            autoFocus
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 3 }}
            variant="outlined"
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading || !username || !password || !database}
            sx={{
              py: 1.5,
              borderRadius: 2,
              fontWeight: 'bold',
              fontSize: '1rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: '0 8px 20px rgba(118, 75, 162, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4199 100%)',
                boxShadow: '0 12px 28px rgba(118, 75, 162, 0.4)',
              },
            }}
          >
            {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Masuk'}
          </Button>
        </form>

        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', textAlign: 'center', mt: 3 }}>
          © 2026 Flexnote Suites • Dashboard v1.0
        </Typography>
      </Paper>
    </Box>
  );
}
