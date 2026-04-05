import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, Grid, Button, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import CalendarToday from '@mui/icons-material/CalendarToday';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import DashboardCard from '../components/DashboardCard';
import { useWidgetConfig } from '../context/WidgetConfigContext';
import { useAuth } from '../context/AuthContext';

export default function DailyView() {
  const { dailyConfigs } = useWidgetConfig();
  const { fetchWithAuth } = useAuth();
  const [data, setData] = useState({
    kpi: null, group: [], costcenter: [], chart: [], cashier: [], recent: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState('');
  
  const [dateRange, setDateRange] = useState('today');
  const [anchorEl, setAnchorEl] = useState(null);

  // Custom Date States
  const [openCustomOption, setOpenCustomOption] = useState(false);
  const [tempStart, setTempStart] = useState(new Date().toISOString().slice(0, 10));
  const [tempEnd, setTempEnd] = useState(new Date().toISOString().slice(0, 10));
  const [customStart, setCustomStart] = useState(new Date().toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10));

  const getDates = () => {
    const today = new Date();
    let start = new Date();
    let end = new Date();
    
    if (dateRange === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (dateRange === 'last_month') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (dateRange === 'custom') {
      if (customStart) {
        const [y, m, d] = customStart.split('-').map(Number);
        start = new Date(y, m - 1, d);
      }
      if (customEnd) {
        const [y, m, d] = customEnd.split('-').map(Number);
        end = new Date(y, m - 1, d);
      }
    }
    
    const toYYYYMMDD = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    return {
      startStr: toYYYYMMDD(start),
      endStr: toYYYYMMDD(end),
      startLabel: start.toLocaleDateString('id-ID', {day:'2-digit', month:'short', year: dateRange === 'custom' ? 'numeric' : undefined}),
      endLabel: end.toLocaleDateString('id-ID', {day:'2-digit', month:'short', year: dateRange === 'custom' ? 'numeric' : undefined})
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const baseUrl = '/api/daily';
      const { startStr, endStr } = getDates();
      const dateParams = `?startDate=${startStr}&endDate=${endStr}`;

      try {
        const [kpiRes, groupRes, ccRes, chartRes, cashierRes, recentRes, syncRes] = await Promise.all([
          fetchWithAuth(`${baseUrl}/kpi${dateParams}`).then(r => r.json()),
          fetchWithAuth(`${baseUrl}/group${dateParams}`).then(r => r.json()),
          fetchWithAuth(`${baseUrl}/costcenter${dateParams}`).then(r => r.json()),
          fetchWithAuth(`${baseUrl}/chart${dateParams}`).then(r => r.json()),
          fetchWithAuth(`${baseUrl}/cashier${dateParams}`).then(r => r.json()),
          fetchWithAuth(`${baseUrl}/recent${dateParams}`).then(r => r.json()),
          fetchWithAuth(`/api/settings/last-sync`).then(r => r.json())
        ]);
        
        setData({
          kpi: kpiRes, group: groupRes, costcenter: ccRes, chart: chartRes, cashier: cashierRes, recent: recentRes
        });
        if (syncRes && syncRes.last_sync) setLastSync(syncRes.last_sync);
      } catch (err) {
        setError("Gagal memanggil API Server.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange, customStart, customEnd]);

  const renderConfigCard = (config) => {
    switch (config.id) {
      case 'daily_revenue':
      case 'daily_orders': return <DashboardCard config={config} data={data.kpi} nameKey="-" valKey="-" />;
      case 'daily_group': return <DashboardCard config={config} data={data.group} nameKey="description" valKey="total" />;
      case 'daily_costcenter': return <DashboardCard config={config} data={data.costcenter} nameKey="description" valKey="total" />;
      case 'daily_chart': return <DashboardCard config={config} data={data.chart} nameKey="tgl" valKey="-" />;
      case 'daily_cashier': return <DashboardCard config={config} data={data.cashier} nameKey="createby" valKey="total" />;
      case 'daily_recent': return <DashboardCard config={config} data={data.recent} nameKey="-" valKey="-" />;
      default: return null;
    }
  };

  const visibleConfigs = dailyConfigs.filter(c => c.isVisible).sort((a, b) => a.orderIndex - b.orderIndex);
  const dates = getDates();

  const handleApplyCustomDate = () => {
    setCustomStart(tempStart);
    setCustomEnd(tempEnd);
    setDateRange('custom');
    setOpenCustomOption(false);
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Dashboard Harian</Typography>
          <Typography variant="body2" color="textSecondary">Meresap data transaksi harian Anda</Typography>
          {lastSync && (
            <Typography variant="caption" sx={{ color: '#9a55ff', fontWeight: 'medium', mt: 0.5, display: 'block' }}>
              Update terakhir: {lastSync}
            </Typography>
          )}
        </Box>

        <Box>
          <Button 
            variant="outlined" 
            color="inherit" 
            onClick={(e) => setAnchorEl(e.currentTarget)}
            startIcon={<CalendarToday fontSize="small" sx={{color: '#9a55ff'}} />}
            endIcon={<KeyboardArrowDown fontSize="small" color="action" />}
            sx={{ backgroundColor: 'white', borderColor: '#e0e0e0', px: 2, borderRadius: 2 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {dates.startLabel} - {dates.endLabel}
            </Typography>
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            PaperProps={{ sx: { mt: 1, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', minWidth: 150 } }}
          >
            <MenuItem onClick={() => { setDateRange('today'); setAnchorEl(null); }} selected={dateRange === 'today'}>Hari Ini</MenuItem>
            <MenuItem onClick={() => { setDateRange('month'); setAnchorEl(null); }} selected={dateRange === 'month'}>Bulan Ini</MenuItem>
            <MenuItem onClick={() => { setDateRange('last_month'); setAnchorEl(null); }} selected={dateRange === 'last_month'}>Bulan Lalu</MenuItem>
            <MenuItem onClick={() => { setAnchorEl(null); setOpenCustomOption(true); }} selected={dateRange === 'custom'}>Pilih Rentang...</MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Dialog Custom Date */}
      <Dialog open={openCustomOption} onClose={() => setOpenCustomOption(false)} PaperProps={{sx: {borderRadius: 3, p: 1}}}>
        <DialogTitle sx={{fontWeight: 'bold'}}>Pilih Rentang Tanggal</DialogTitle>
        <DialogContent sx={{display: 'flex', flexDirection: 'column', gap: 3, pt: 2, minWidth: 300}}>
          <TextField
            label="Mulai Tanggal"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={tempStart}
            onChange={(e) => setTempStart(e.target.value)}
            fullWidth
          />
          <TextField
            label="Sampai Tanggal"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={tempEnd}
            onChange={(e) => setTempEnd(e.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCustomOption(false)} color="inherit">Batal</Button>
          <Button onClick={handleApplyCustomDate} variant="contained" sx={{backgroundColor: '#9a55ff', color: 'white', '&:hover': {backgroundColor: '#b66dff'} }}>Terapkan</Button>
        </DialogActions>
      </Dialog>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {loading ? (
         <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
           <CircularProgress sx={{color: '#9a55ff'}} />
         </Box>
      ) : (
        <Grid container spacing={3}>
          {visibleConfigs.map(config => {
            // Force anything that is not a basic revenue/order KPI to be 100% width
            const isKpi = config.id === 'daily_revenue' || config.id === 'daily_orders';
            const width = isKpi ? 6 : 12;
            
            return (
              <Grid size={{ xs: 12, sm: width, md: width, lg: width, xl: width }} key={config.id}>
                {renderConfigCard(config)}
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
