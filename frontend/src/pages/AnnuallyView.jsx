import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, Grid, Button, Menu, MenuItem } from '@mui/material';
import { CalendarToday, KeyboardArrowDown } from '@mui/icons-material';
import DashboardCard from '../components/DashboardCard';
import { useWidgetConfig } from '../context/WidgetConfigContext';
import { useAuth } from '../context/AuthContext';

export default function AnnuallyView() {
  const { annuallyConfigs } = useWidgetConfig();
  const { fetchWithAuth } = useAuth();
  const [data, setData] = useState({
    kpi: null,
    chart: [],
    cashier: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [anchorEl, setAnchorEl] = useState(null);

  // Generate list of 5 recent years
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const baseUrl = '/api/annually';

      try {
        const [kpiRes, chartRes, cashierRes] = await Promise.all([
          fetchWithAuth(`${baseUrl}/kpi?year=${selectedYear}`).then(r => r.json()),
          fetchWithAuth(`${baseUrl}/chart?year=${selectedYear}`).then(r => r.json()),
          fetchWithAuth(`${baseUrl}/cashier?year=${selectedYear}`).then(r => r.json()),
        ]);
        
        setData({
          kpi: kpiRes,
          chart: chartRes.map(item => ({...item, name: `Bulan ${item.bulan}`})), // Adjust for rechart
          cashier: cashierRes,
        });
      } catch (err) {
        setError("Gagal memanggil API Server.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedYear]);

  const renderConfigCard = (config) => {
    switch (config.id) {
      case 'annual_revenue':
      case 'annual_orders':
        return <DashboardCard config={config} data={data.kpi} nameKey="-" valKey="-" />;
      case 'annual_chart':
        return <DashboardCard config={config} data={data.chart} nameKey="name" valKey="total" />;
      case 'annual_cashier':
        return <DashboardCard config={config} data={data.cashier} nameKey="createby" valKey="total" />;
      default:
        return null;
    }
  };

  const visibleConfigs = annuallyConfigs.filter(c => c.isVisible).sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Dashboard Tahunan</Typography>
          <Typography variant="body2" color="textSecondary">Ringkasan performa penjualan pada tahun terpilih</Typography>
        </Box>

        <Box>
          <Button 
            variant="outlined" 
            color="inherit" 
            onClick={(e) => setAnchorEl(e.currentTarget)}
            startIcon={<CalendarToday fontSize="small" sx={{color: '#07cdae'}} />}
            endIcon={<KeyboardArrowDown fontSize="small" color="action" />}
            sx={{ backgroundColor: 'white', borderColor: '#e0e0e0', px: 2, borderRadius: 2 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              Tahun {selectedYear}
            </Typography>
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            PaperProps={{ sx: { mt: 1, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', minWidth: 150 } }}
          >
            {availableYears.map(year => (
              <MenuItem 
                key={year} 
                onClick={() => { setSelectedYear(year); setAnchorEl(null); }} 
                selected={selectedYear === year}
              >
                {year}
              </MenuItem>
            ))}
          </Menu>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (
         <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
           <CircularProgress sx={{color: '#07cdae'}} />
         </Box>
      ) : (
        <Grid container spacing={3}>
          {visibleConfigs.map(config => {
            const isKpi = config.id.includes('revenue') || config.id.includes('orders');
            return (
              <Grid item xs={12} sm={isKpi ? 6 : 12} xl={isKpi ? 3 : 12} key={config.id}>
                {renderConfigCard(config)}
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
