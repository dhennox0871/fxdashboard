import React, { useEffect, useMemo, useState } from 'react';
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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AutoGraph from '@mui/icons-material/AutoGraph';
import Inventory2 from '@mui/icons-material/Inventory2';
import Sell from '@mui/icons-material/Sell';
import Refresh from '@mui/icons-material/Refresh';
import { useAuth } from '../context/AuthContext';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const ownerSections = [
];

export default function BiPlanningView() {
  const { fetchWithAuth } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [kpiPeriod, setKpiPeriod] = useState('mtd');
  const [kpiData, setKpiData] = useState(null);
  const [loadingKPI, setLoadingKPI] = useState(true);
  const [kpiError, setKpiError] = useState('');
  const [days, setDays] = useState(30);
  const [scope, setScope] = useState('global');
  const [doiStatusFilter, setDoiStatusFilter] = useState('all');
  const [doiPage, setDoiPage] = useState(0);
  const [doiRowsPerPage, setDoiRowsPerPage] = useState(25);
  const [doiRows, setDoiRows] = useState([]);
  const [loadingDOI, setLoadingDOI] = useState(true);
  const [doiError, setDoiError] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [trendRows, setTrendRows] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState('');
  const [channelRows, setChannelRows] = useState([]);
  const [channelLoading, setChannelLoading] = useState(true);
  const [channelError, setChannelError] = useState('');
  const [channelChartType, setChannelChartType] = useState('bar');
  const [healthData, setHealthData] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState('');
  const [snapshotData, setSnapshotData] = useState({ top_revenue: [], bottom_risk: [] });
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [snapshotError, setSnapshotError] = useState('');
  const [productKPI, setProductKPI] = useState(null);
  const [productKPILoading, setProductKPILoading] = useState(true);
  const [productKPIError, setProductKPIError] = useState('');
  const [categoryRows, setCategoryRows] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryError, setCategoryError] = useState('');
  const [lifecycleRows, setLifecycleRows] = useState([]);
  const [lifecycleLoading, setLifecycleLoading] = useState(true);
  const [lifecycleError, setLifecycleError] = useState('');
  const [performanceData, setPerformanceData] = useState({ top: [], slow: [] });
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [performanceError, setPerformanceError] = useState('');
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [sourceDialogTitle, setSourceDialogTitle] = useState('Data Sumber');
  const [sourceDialogRows, setSourceDialogRows] = useState([]);
  const [sourceDialogPage, setSourceDialogPage] = useState(0);
  const [sourceDialogRowsPerPage, setSourceDialogRowsPerPage] = useState(10);

  const parseJsonSafe = async (res) => {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  };

  const fetchExecutiveKPI = async () => {
    setLoadingKPI(true);
    setKpiError('');
    try {
      const res = await fetchWithAuth(`/api/bi/executive-kpi?period=${kpiPeriod}`);
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        if (typeof data.raw === 'string' && data.raw.includes('Cannot GET')) {
          throw new Error('Endpoint KPI BI belum aktif. Restart backend lokal agar route /api/bi/executive-kpi terbaca.');
        }
        throw new Error(data.error || data.raw || 'Gagal memuat KPI executive');
      }
      setKpiData(data);
    } catch (err) {
      setKpiError(err.message || 'Gagal memuat KPI executive');
      setKpiData(null);
    } finally {
      setLoadingKPI(false);
    }
  };

  const fetchDOI = async () => {
    setLoadingDOI(true);
    setDoiError('');
    try {
      const res = await fetchWithAuth(`/api/bi/doi?days=${days}&scope=${scope}`);
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        if (typeof data.raw === 'string' && data.raw.includes('Cannot GET')) {
          throw new Error('Endpoint DOI BI belum aktif. Restart backend lokal agar route /api/bi/doi terbaca.');
        }
        throw new Error(data.error || data.raw || 'Gagal memuat data DOI');
      }
      setDoiRows(data.rows || []);
    } catch (err) {
      setDoiError(err.message || 'Gagal memuat data DOI');
      setDoiRows([]);
    } finally {
      setLoadingDOI(false);
    }
  };

  const fetchRevenueTrend = async () => {
    setTrendLoading(true);
    setTrendError('');
    try {
      const channelParam = channelFilter ? `&channel=${encodeURIComponent(channelFilter)}` : '';
      const res = await fetchWithAuth(`/api/bi/revenue-trend?period=${kpiPeriod}${channelParam}`);
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || data.raw || 'Gagal memuat revenue trend');
      setTrendRows((data.rows || []).map((r) => ({
        ...r,
        revenue: Number(r.revenue || 0),
        label: (r.date || '').slice(5),
      })));
    } catch (err) {
      setTrendError(err.message || 'Gagal memuat revenue trend');
      setTrendRows([]);
    } finally {
      setTrendLoading(false);
    }
  };

  const fetchChannelContribution = async () => {
    setChannelLoading(true);
    setChannelError('');
    try {
      const res = await fetchWithAuth(`/api/bi/channel-contribution?period=${kpiPeriod}`);
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || data.raw || 'Gagal memuat channel contribution');
      setChannelRows((data.rows || []).map((r) => ({
        ...r,
        revenue: Number(r.revenue || 0),
        contribution: Number(r.contribution || 0),
      })));
    } catch (err) {
      setChannelError(err.message || 'Gagal memuat channel contribution');
      setChannelRows([]);
    } finally {
      setChannelLoading(false);
    }
  };

  const fetchBusinessHealth = async () => {
    setHealthLoading(true);
    setHealthError('');
    try {
      const res = await fetchWithAuth(`/api/bi/business-health?period=${kpiPeriod}&days=30`);
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || data.raw || 'Gagal memuat business health');
      setHealthData(data);
    } catch (err) {
      setHealthError(err.message || 'Gagal memuat business health');
      setHealthData(null);
    } finally {
      setHealthLoading(false);
    }
  };

  const fetchProductSnapshot = async () => {
    setSnapshotLoading(true);
    setSnapshotError('');
    try {
      const res = await fetchWithAuth(`/api/bi/product-snapshot?period=${kpiPeriod}`);
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || data.raw || 'Gagal memuat product snapshot');
      setSnapshotData({
        top_revenue: data.top_revenue || [],
        bottom_risk: data.bottom_risk || [],
      });
    } catch (err) {
      setSnapshotError(err.message || 'Gagal memuat product snapshot');
      setSnapshotData({ top_revenue: [], bottom_risk: [] });
    } finally {
      setSnapshotLoading(false);
    }
  };

  const fetchProductKPI = async () => {
    setProductKPILoading(true);
    setProductKPIError('');
    try {
      const res = await fetchWithAuth(`/api/bi/product-kpi?period=${kpiPeriod}`);
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || data.raw || 'Gagal memuat sales KPI');
      setProductKPI(data);
    } catch (err) {
      setProductKPIError(err.message || 'Gagal memuat sales KPI');
      setProductKPI(null);
    } finally {
      setProductKPILoading(false);
    }
  };

  const fetchCategoryPerformance = async () => {
    setCategoryLoading(true);
    setCategoryError('');
    try {
      const res = await fetchWithAuth(`/api/bi/category-performance?period=${kpiPeriod}`);
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || data.raw || 'Gagal memuat category performance');
      setCategoryRows(
        (data.rows || []).map((r) => ({
          ...r,
          revenue: Number(r.revenue || 0),
          units: Number(r.units || 0),
          margin_pct: Number(r.margin_pct || 0),
        })),
      );
    } catch (err) {
      setCategoryError(err.message || 'Gagal memuat category performance');
      setCategoryRows([]);
    } finally {
      setCategoryLoading(false);
    }
  };

  const fetchProductLifecycle = async () => {
    setLifecycleLoading(true);
    setLifecycleError('');
    try {
      const res = await fetchWithAuth(`/api/bi/product-lifecycle?period=${kpiPeriod}`);
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || data.raw || 'Gagal memuat product lifecycle');
      setLifecycleRows(
        (data.rows || []).map((r) => ({
          ...r,
          count: Number(r.count || 0),
          percent: Number(r.percent || 0),
        })),
      );
    } catch (err) {
      setLifecycleError(err.message || 'Gagal memuat product lifecycle');
      setLifecycleRows([]);
    } finally {
      setLifecycleLoading(false);
    }
  };

  const fetchProductPerformance = async () => {
    setPerformanceLoading(true);
    setPerformanceError('');
    try {
      const res = await fetchWithAuth(`/api/bi/product-performance?period=${kpiPeriod}&days=8`);
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || data.raw || 'Gagal memuat top & slow product');
      setPerformanceData({
        top: data.top || [],
        slow: data.slow || [],
      });
    } catch (err) {
      setPerformanceError(err.message || 'Gagal memuat top & slow product');
      setPerformanceData({ top: [], slow: [] });
    } finally {
      setPerformanceLoading(false);
    }
  };

  useEffect(() => {
    fetchDOI();
  }, [days, scope]);

  useEffect(() => {
    fetchExecutiveKPI();
  }, [kpiPeriod]);

  useEffect(() => {
    if (activeTab === 0) {
      fetchChannelContribution();
      fetchBusinessHealth();
      fetchProductSnapshot();
    }
  }, [kpiPeriod, activeTab]);

  useEffect(() => {
    if (activeTab === 0) {
      fetchRevenueTrend();
    }
  }, [kpiPeriod, channelFilter, activeTab]);

  useEffect(() => {
    if (activeTab === 2) {
      fetchProductKPI();
      fetchCategoryPerformance();
      fetchProductLifecycle();
      fetchProductPerformance();
    }
  }, [kpiPeriod, activeTab]);

  const formatNumber = (value) => {
    const n = Number(value || 0);
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
  };

  const formatCurrency = (value) => {
    const n = Number(value || 0);
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(n);
  };

  const toSourceRows = (input) => {
    if (Array.isArray(input)) {
      return input.map((row, index) => {
        if (row && typeof row === 'object') return row;
        return { value: row, row_no: index + 1 };
      });
    }
    if (input && typeof input === 'object') return [input];
    if (input == null) return [];
    return [{ value: input }];
  };

  const openSourceDialog = (title, rows) => {
    setSourceDialogTitle(title || 'Data Sumber');
    setSourceDialogRows(toSourceRows(rows));
    setSourceDialogPage(0);
    setSourceDialogOpen(true);
  };

  const openSourceFromChartState = (title, state, fallbackRows) => {
    const payloadRow = state?.activePayload?.[0]?.payload;
    if (payloadRow && typeof payloadRow === 'object') {
      openSourceDialog(title, [payloadRow]);
      return;
    }
    openSourceDialog(title, fallbackRows);
  };

  const sourceColumns = useMemo(() => {
    if (sourceDialogRows.length === 0) return [];
    const keys = new Set();
    sourceDialogRows.forEach((row) => {
      Object.keys(row || {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [sourceDialogRows]);

  const pagedSourceDialogRows = useMemo(() => {
    const start = sourceDialogPage * sourceDialogRowsPerPage;
    return sourceDialogRows.slice(start, start + sourceDialogRowsPerPage);
  }, [sourceDialogRows, sourceDialogPage, sourceDialogRowsPerPage]);

  const sourceButtonSx = {
    textTransform: 'none',
    fontWeight: 700,
    borderColor: '#d3c6f8',
    color: '#6d4bc3',
    backgroundColor: '#f5f0ff',
    px: 1.25,
    py: 0.2,
    minWidth: 'auto',
    '&:hover': {
      borderColor: '#bca9ef',
      backgroundColor: '#ebe2ff',
    },
  };

  const sourceColumnLabel = (column) => {
    const map = {
      channel: 'Channel',
      category: 'Kategori',
      count: 'Jumlah',
      contribution: 'Kontribusi (%)',
      createby: 'Kasir',
      date: 'Tanggal',
      doi: 'DOI',
      margin_pct: 'Margin (%)',
      name: 'Nama',
      percent: 'Persentase (%)',
      phase: 'Fase',
      revenue: 'Revenue',
      stock_qty: 'Stok',
      total: 'Total',
      units: 'Unit',
      value: 'Nilai',
      bulan: 'Bulan',
      label: 'Label',
    };
    return map[column] || column;
  };

  const isCurrencyColumn = (column) => {
    const key = String(column || '').toLowerCase();
    return key.includes('revenue') || key === 'total' || key.includes('sales');
  };

  const isNumericColumn = (column) => {
    const key = String(column || '').toLowerCase();
    return (
      key === 'bulan' ||
      key.includes('count') ||
      key.includes('qty') ||
      key.includes('unit') ||
      key.includes('stock') ||
      key.includes('doi') ||
      key.includes('margin') ||
      key.includes('percent') ||
      key.includes('contribution') ||
      key.includes('total') ||
      key.includes('revenue') ||
      key.includes('value')
    );
  };

  const isSummableColumn = (column) => {
    const key = String(column || '').toLowerCase();
    if (key === 'bulan' || key.includes('percent') || key.includes('margin') || key.includes('doi')) {
      return false;
    }
    return (
      key.includes('revenue') ||
      key === 'total' ||
      key.includes('count') ||
      key.includes('qty') ||
      key.includes('unit') ||
      key.includes('stock') ||
      key.includes('value')
    );
  };

  const sourceTotals = useMemo(() => {
    const totals = {};
    sourceColumns.forEach((column) => {
      if (!isSummableColumn(column)) return;
      let sum = 0;
      let hasValue = false;
      sourceDialogRows.forEach((row) => {
        const value = Number(row?.[column]);
        if (Number.isFinite(value)) {
          sum += value;
          hasValue = true;
        }
      });
      if (hasValue) {
        totals[column] = sum;
      }
    });
    return totals;
  }, [sourceColumns, sourceDialogRows]);

  const hasSourceTotals = Object.keys(sourceTotals).length > 0;

  const renderSourceValue = (column, value) => {
    if (value == null || value === '') return '-';

    const numeric = Number(value);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric) && isCurrencyColumn(column)) {
      return formatCurrency(numeric);
    }
    if (!Number.isNaN(numeric) && Number.isFinite(numeric) && isNumericColumn(column)) {
      return formatNumber(numeric);
    }
    return String(value);
  };

  const chartColors = ['#9a55ff', '#07cdae', '#047edf', '#ffbf96', '#fe7096', '#81C784'];
  const uniformKpiCardSx = {
    p: 1.5,
    borderRadius: 2,
    minHeight: 100,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 0.8,
  };
  const trendChartRows = trendRows.filter((r) => Number.isFinite(Number(r.revenue)));
  const contributionChartRows = channelRows.filter((r) => Number.isFinite(Number(r.revenue)) && Number(r.revenue) > 0);
  const categoryChartRows = categoryRows.slice(0, 8);
  const lifecycleChartRows = lifecycleRows.filter((r) => r.count > 0);
  const doiStatusOptions = useMemo(() => {
    const setStatus = new Set();
    doiRows.forEach((row) => {
      const status = String(row.status || '').trim();
      if (status) setStatus.add(status);
    });
    return Array.from(setStatus);
  }, [doiRows]);
  const filteredDoiRows = useMemo(() => {
    if (doiStatusFilter === 'all') return doiRows;
    return doiRows.filter((row) => String(row.status || '').trim() === doiStatusFilter);
  }, [doiRows, doiStatusFilter]);
  const pagedDoiRows = useMemo(() => {
    const start = doiPage * doiRowsPerPage;
    return filteredDoiRows.slice(start, start + doiRowsPerPage);
  }, [filteredDoiRows, doiPage, doiRowsPerPage]);

  useEffect(() => {
    setDoiPage(0);
  }, [days, scope, doiStatusFilter, doiRowsPerPage]);

  const statusChipColor = (status) => {
    if (status === 'Urgent') return 'error';
    if (status === 'Waspada') return 'warning';
    if (status === 'Normal') return 'success';
    if (status === 'Out of Stock') return 'default';
    return 'default';
  };

  const opsSummary = useMemo(() => {
    const items = Array.isArray(doiRows) ? doiRows : [];
    const uniqInStock = new Set();
    let totalStock = 0;
    let doiTotal = 0;
    let doiCount = 0;
    let urgentCount = 0;
    let outOfStockCount = 0;

    const outOfStockRows = [];
    const lowStockRows = [];

    for (const row of items) {
      const stock = Number(row.stock_qty || 0);
      const doi = row.doi == null ? null : Number(row.doi);
      const key = `${row.item_id || ''}-${row.warehouse_code || 'GLOBAL'}`;

      if (stock > 0 && row.item_id != null) {
        uniqInStock.add(row.item_id);
      }
      if (stock > 0) totalStock += stock;
      if (Number.isFinite(doi) && doi > 0) {
        doiTotal += doi;
        doiCount += 1;
      }

      if (row.status === 'Urgent') urgentCount += 1;
      if (row.status === 'Out of Stock') {
        outOfStockCount += 1;
        outOfStockRows.push({
          key,
          itemCode: row.item_code || `ITEM-${row.item_id}`,
          warehouse: row.warehouse_code || 'GLOBAL',
        });
      }

      if (Number.isFinite(doi) && doi > 0 && doi < 14 && stock > 0) {
        lowStockRows.push({
          key,
          itemCode: row.item_code || `ITEM-${row.item_id}`,
          warehouse: row.warehouse_code || 'GLOBAL',
          stock,
          avgDaily: Number(row.avg_daily_sold || 0),
          doi,
        });
      }
    }

    lowStockRows.sort((a, b) => a.doi - b.doi);

    return {
      totalSKUActive: uniqInStock.size,
      totalStock,
      averageDOI: doiCount > 0 ? doiTotal / doiCount : 0,
      urgentCount,
      outOfStockCount,
      outOfStockRows: outOfStockRows.slice(0, 7),
      lowStockRows: lowStockRows.slice(0, 7),
    };
  }, [doiRows]);

  return (
    <Box>
      <Paper
        sx={{
          mb: 2.5,
          borderRadius: 2.5,
          position: 'sticky',
          top: { xs: 64, sm: 72 },
          zIndex: 12,
          backgroundColor: '#fff',
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 1 }}
        >
          <Tab icon={<AutoGraph />} iconPosition="start" label="Owner (Executive View)" />
          <Tab icon={<Inventory2 />} iconPosition="start" label="Ops & Inventory" />
          <Tab icon={<Sell />} iconPosition="start" label="Product & Sales" />
        </Tabs>
      </Paper>

      {activeTab === 0 && (
        <>
          {ownerSections.length > 0 && (
            <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Roadmap Owner Dashboard</Typography>
              <Stack spacing={0.8}>
                {ownerSections.map((item) => (
                  <Typography key={item} variant="body2" color="text.secondary">- {item}</Typography>
                ))}
              </Stack>
            </Paper>
          )}

          <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', md: 'center' }}
              spacing={1.2}
              sx={{ mb: 2 }}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>A. KPI Cards (Top Section)</Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant={kpiPeriod === 'today' ? 'contained' : 'outlined'}
                  onClick={() => setKpiPeriod('today')}
                >
                  Today
                </Button>
                <Button
                  size="small"
                  variant={kpiPeriod === 'mtd' ? 'contained' : 'outlined'}
                  onClick={() => setKpiPeriod('mtd')}
                >
                  MTD (Bulan Berjalan)
                </Button>
              </Stack>
            </Stack>

            {kpiError && <Alert severity="warning" sx={{ mb: 2 }}>{kpiError}</Alert>}

            {loadingKPI ? (
              <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={1.2}>
                <Grid item xs={12} sm={6} md={4} lg={2}>
                  <Paper variant="outlined" sx={uniformKpiCardSx}>
                    <Typography variant="caption" color="text.secondary">Revenue {kpiPeriod.toUpperCase()}</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatCurrency(kpiData?.revenue)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={2}>
                  <Paper variant="outlined" sx={uniformKpiCardSx}>
                    <Typography variant="caption" color="text.secondary">Orders {kpiPeriod.toUpperCase()}</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatNumber(kpiData?.orders)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={2}>
                  <Paper variant="outlined" sx={uniformKpiCardSx}>
                    <Typography variant="caption" color="text.secondary">Units Sold</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatNumber(kpiData?.units_sold)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={2}>
                  <Paper variant="outlined" sx={uniformKpiCardSx}>
                    <Typography variant="caption" color="text.secondary">Gross Profit</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatCurrency(kpiData?.gross_profit)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={2}>
                  <Paper variant="outlined" sx={uniformKpiCardSx}>
                    <Typography variant="caption" color="text.secondary">Gross Margin %</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {formatNumber(kpiData?.gross_margin)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">Target {'>='} 40%</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={2}>
                  <Paper variant="outlined" sx={uniformKpiCardSx}>
                    <Typography variant="caption" color="text.secondary">AOV</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatCurrency(kpiData?.aov)}</Typography>
                  </Paper>
                </Grid>
              </Grid>
            )}
          </Paper>

          <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>B. Revenue Trend</Typography>
                <Typography variant="body2" color="text.secondary">Line chart revenue per tanggal, filter channel (costcenter).</Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button variant="outlined" onClick={() => openSourceDialog('Data Sumber - Revenue Trend', trendChartRows)} sx={sourceButtonSx}>
                  Lihat Data Sumber
                </Button>
                <TextField
                  select
                  size="small"
                  label="Filter Channel"
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="">Semua Channel</MenuItem>
                  {channelRows.map((row) => (
                    <MenuItem key={row.channel} value={row.channel}>{row.channel}</MenuItem>
                  ))}
                </TextField>
                <Button variant="outlined" startIcon={<Refresh />} onClick={fetchRevenueTrend}>Refresh</Button>
              </Stack>
            </Stack>

            {trendError && <Alert severity="warning" sx={{ mb: 2 }}>{trendError}</Alert>}
            {trendLoading ? (
              <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
            ) : trendChartRows.length === 0 ? (
              <Alert severity="info">Belum ada data trend untuk filter periode/channel ini.</Alert>
            ) : (
              <Box sx={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={trendChartRows}
                    margin={{ top: 12, right: 20, left: 10, bottom: 0 }}
                    onClick={(state) => openSourceFromChartState('Detail Titik - Revenue Trend', state, trendChartRows)}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(v)} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={(v) => `Tanggal ${v}`} />
                    <Area type="monotone" dataKey="revenue" stroke="#9a55ff" fill="#9a55ff22" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>

          <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>C. Channel Contribution</Typography>
                <Typography variant="body2" color="text.secondary">Kontribusi revenue per channel berdasarkan costcenter.</Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={() => openSourceDialog('Data Sumber - Channel Contribution', contributionChartRows)} sx={sourceButtonSx}>
                  Lihat Data Sumber
                </Button>
                <Button size="small" variant={channelChartType === 'bar' ? 'contained' : 'outlined'} onClick={() => setChannelChartType('bar')}>Bar</Button>
                <Button size="small" variant={channelChartType === 'pie' ? 'contained' : 'outlined'} onClick={() => setChannelChartType('pie')}>Pie</Button>
                <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={fetchChannelContribution}>Refresh</Button>
              </Stack>
            </Stack>

            {channelError && <Alert severity="warning" sx={{ mb: 2 }}>{channelError}</Alert>}
            {channelLoading ? (
              <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
            ) : contributionChartRows.length === 0 ? (
              <Alert severity="info">Belum ada data channel contribution untuk periode ini.</Alert>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ width: '100%', minHeight: 280, overflowX: 'auto' }}>
                    {channelChartType === 'bar' ? (
                      <BarChart
                        width={520}
                        height={280}
                        data={contributionChartRows}
                        margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                        onClick={(state) => openSourceFromChartState('Detail Titik - Channel Contribution', state, contributionChartRows)}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(v)} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => formatCurrency(v)} />
                        <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                          {contributionChartRows.map((entry, idx) => (
                            <Cell key={entry.channel} fill={chartColors[idx % chartColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : (
                      <PieChart width={420} height={280}>
                        <Pie
                          data={contributionChartRows}
                          dataKey="revenue"
                          nameKey="channel"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={95}
                          onClick={(entry) => openSourceDialog('Detail Titik - Channel Contribution', [entry?.payload || entry])}
                        >
                          {contributionChartRows.map((entry, idx) => (
                            <Cell key={entry.channel} fill={chartColors[idx % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => formatCurrency(v)} />
                      </PieChart>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Channel</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Revenue</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>% Contribution</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {channelRows.map((row, idx) => (
                          <TableRow key={row.channel} hover>
                            <TableCell>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Box
                                  sx={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    backgroundColor: chartColors[idx % chartColors.length],
                                    flexShrink: 0,
                                  }}
                                />
                                <Typography variant="body2">{row.channel}</Typography>
                              </Stack>
                            </TableCell>
                            <TableCell align="right">{formatCurrency(row.revenue)}</TableCell>
                            <TableCell align="right">{formatNumber(row.contribution)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            )}
          </Paper>

          <Box
            sx={{
              mb: 3,
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              alignItems: 'stretch',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Paper sx={{ p: 2, borderRadius: 2.5, height: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>D. Business Health Alert</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Ringkasan indikator operasional untuk periode {kpiPeriod.toUpperCase()}.
                </Typography>

                {healthError && <Alert severity="warning" sx={{ mb: 1.5 }}>{healthError}</Alert>}
                {healthLoading ? (
                  <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
                ) : (
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell>Out of Stock SKU</TableCell>
                        <TableCell align="right"><Chip size="small" label={formatNumber(healthData?.out_of_stock_sku)} /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>SKU &lt; 14 hari stok</TableCell>
                        <TableCell align="right"><Chip size="small" color="warning" label={formatNumber(healthData?.sku_lt_14_days_stock)} /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Slow Moving SKU</TableCell>
                        <TableCell align="right"><Chip size="small" label={formatNumber(healthData?.slow_moving_sku)} /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Cancel Rate</TableCell>
                        <TableCell align="right"><Chip size="small" label={`${formatNumber(healthData?.cancel_rate)}%`} /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Margin &lt; Target</TableCell>
                        <TableCell align="right"><Chip size="small" color="error" label={formatNumber(healthData?.margin_below_target_sku)} /></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Paper sx={{ p: 2, borderRadius: 2.5, height: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>E. Top 5 SKU by Revenue</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>SKU dengan kontribusi revenue tertinggi.</Typography>

                {snapshotError && <Alert severity="warning" sx={{ mb: 1.5 }}>{snapshotError}</Alert>}
                {snapshotLoading ? (
                  <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
                ) : (
                  <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Revenue</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Margin</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(snapshotData.top_revenue || []).map((row) => (
                        <TableRow key={`top-${row.item_id}`} hover>
                          <TableCell>
                            <Typography variant="body2" noWrap title={row.item_code || `ITEM-${row.item_id}`}>
                              {row.item_code || `ITEM-${row.item_id}`}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{formatCurrency(row.revenue)}</TableCell>
                          <TableCell align="right">{formatNumber(row.margin_pct)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Paper sx={{ p: 2, borderRadius: 2.5, height: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>F. Bottom 5 SKU (Risk)</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>SKU risiko berdasarkan STR rendah dan stok tinggi.</Typography>

                {snapshotError && <Alert severity="warning" sx={{ mb: 1.5 }}>{snapshotError}</Alert>}
                {snapshotLoading ? (
                  <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
                ) : (
                  <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>STR %</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Stock</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(snapshotData.bottom_risk || []).map((row) => (
                        <TableRow key={`risk-${row.item_id}`} hover>
                          <TableCell>
                            <Typography variant="body2" noWrap title={row.item_code || `ITEM-${row.item_id}`}>
                              {row.item_code || `ITEM-${row.item_id}`}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{formatNumber(row.str_percent)}%</TableCell>
                          <TableCell align="right">{formatNumber(row.stock_qty)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Box>
          </Box>
        </>
      )}

      {activeTab === 1 && (
        <>
          <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>A. Inventory KPI</Typography>
            <Grid container spacing={1.2}>
              <Grid item xs={12} sm={6} md={3}>
                  <Paper variant="outlined" sx={uniformKpiCardSx}>
                  <Typography variant="caption" color="text.secondary">Total SKU Aktif</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatNumber(opsSummary.totalSKUActive)}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                  <Paper variant="outlined" sx={uniformKpiCardSx}>
                  <Typography variant="caption" color="text.secondary">Total Stock (pcs)</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatNumber(opsSummary.totalStock)}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                  <Paper variant="outlined" sx={uniformKpiCardSx}>
                  <Typography variant="caption" color="text.secondary">Rata-rata DOI</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatNumber(opsSummary.averageDOI)} hari</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                  <Paper variant="outlined" sx={uniformKpiCardSx}>
                  <Typography variant="caption" color="text.secondary">SKU Urgent (&lt;14 hari)</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatNumber(opsSummary.urgentCount)}</Typography>
                </Paper>
              </Grid>
            </Grid>
          </Paper>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2.5, borderRadius: 2.5, height: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>B. Low & Out of Stock Alert</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Prioritas item berdasarkan status Out of Stock dan DOI &lt; 14 hari.
                </Typography>

                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>Out of Stock ({formatNumber(opsSummary.outOfStockCount)})</Typography>
                    {opsSummary.outOfStockRows.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">Tidak ada item out of stock pada scope aktif.</Typography>
                    ) : (
                      <Stack spacing={0.6}>
                        {opsSummary.outOfStockRows.map((row) => (
                          <Typography key={`oos-${row.key}`} variant="caption">{row.itemCode} • {row.warehouse}</Typography>
                        ))}
                      </Stack>
                    )}
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>DOI &lt; 14 hari</Typography>
                    {opsSummary.lowStockRows.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">Tidak ada item DOI rendah pada scope aktif.</Typography>
                    ) : (
                      <Stack spacing={0.6}>
                        {opsSummary.lowStockRows.map((row) => (
                          <Typography key={`low-${row.key}`} variant="caption">
                            {row.itemCode} • {row.warehouse} • DOI {formatNumber(row.doi)}
                          </Typography>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2.5, borderRadius: 2.5, height: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>C. Size / Dimensi Performance</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Dimensi produk (length/width/height/depth/weight) sudah tersedia di data sumber. Visual detail size performance akan ditambahkan pada iterasi berikutnya.
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
                  <Chip color="success" label="Dimensi masteritemuom: READY" />
                  <Chip color="warning" label="Chart size mix: NEXT" />
                </Stack>
              </Paper>
            </Grid>
          </Grid>

          <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>D. DOI Simulator</Typography>
            <Typography variant="body2" color="text.secondary">
              Rumus: DOI = Stock On Hand / Average Net Sold per Day, dengan aturan transaksi sesuai mapping yang Anda berikan.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
            <TextField
              select
              size="small"
              label="Periode"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              sx={{ minWidth: 130 }}
            >
              <MenuItem value={30}>30 Hari</MenuItem>
              <MenuItem value={60}>60 Hari</MenuItem>
              <MenuItem value={90}>90 Hari</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="Scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="global">Global</MenuItem>
              <MenuItem value="warehouse">Per Gudang</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="Status"
              value={doiStatusFilter}
              onChange={(e) => setDoiStatusFilter(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="all">Semua Status</MenuItem>
              {doiStatusOptions.map((status) => (
                <MenuItem key={status} value={status}>{status}</MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" startIcon={<Refresh />} onClick={fetchDOI}>
              Refresh
            </Button>
          </Stack>
        </Stack>

        {doiError && <Alert severity="warning" sx={{ mb: 2 }}>{doiError}</Alert>}

        {loadingDOI ? (
          <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>UOM Dasar</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Gudang</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Stock</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Net Sold ({days}h)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Avg/Hari</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>DOI</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDoiRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography variant="body2" color="text.secondary">Belum ada data DOI yang cocok dengan filter saat ini.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedDoiRows.map((row) => (
                    <TableRow key={`${row.item_id}-${row.warehouse_id || 'global'}`} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.item_code || `ITEM-${row.item_id}`}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.item_name || '-'}</Typography>
                      </TableCell>
                      <TableCell>{row.base_uom || '-'}</TableCell>
                      <TableCell>{row.warehouse_code || 'GLOBAL'}</TableCell>
                      <TableCell align="right">{formatNumber(row.stock_qty)}</TableCell>
                      <TableCell align="right">{formatNumber(row.net_sold_qty)}</TableCell>
                      <TableCell align="right">{formatNumber(row.avg_daily_sold)}</TableCell>
                      <TableCell align="right">{row.doi == null ? '-' : formatNumber(row.doi)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status || '-'} color={statusChipColor(row.status)} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={filteredDoiRows.length}
              page={doiPage}
              onPageChange={(_, newPage) => setDoiPage(newPage)}
              rowsPerPage={doiRowsPerPage}
              onRowsPerPageChange={(e) => {
                setDoiRowsPerPage(Number(e.target.value));
                setDoiPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage="Baris per halaman"
            />
          </TableContainer>
        )}
          </Paper>
        </>
      )}

      {activeTab === 2 && (
        <>
          <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', md: 'center' }}
              spacing={1.5}
            >
              <Typography variant="h6" sx={{ fontWeight: 700 }}>A. Sales KPI</Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant={kpiPeriod === 'today' ? 'contained' : 'outlined'}
                  onClick={() => setKpiPeriod('today')}
                >
                  Today
                </Button>
                <Button
                  size="small"
                  variant={kpiPeriod === 'mtd' ? 'contained' : 'outlined'}
                  onClick={() => setKpiPeriod('mtd')}
                >
                  MTD
                </Button>
              </Stack>
            </Stack>

            {productKPIError && <Alert severity="warning" sx={{ mt: 2 }}>{productKPIError}</Alert>}
            {productKPILoading ? (
              <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
            ) : (
              <Grid container spacing={1.2} sx={{ mt: 0.5 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper variant="outlined" sx={uniformKpiCardSx}>
                    <Typography variant="caption" color="text.secondary">Revenue</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatCurrency(productKPI?.revenue)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper variant="outlined" sx={uniformKpiCardSx}>
                    <Typography variant="caption" color="text.secondary">Units</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatNumber(productKPI?.units)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper variant="outlined" sx={uniformKpiCardSx}>
                    <Typography variant="caption" color="text.secondary">Avg Margin</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatNumber(productKPI?.avg_margin)}%</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper variant="outlined" sx={uniformKpiCardSx}>
                    <Typography variant="caption" color="text.secondary">Sell-through</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatNumber(productKPI?.sell_through)}%</Typography>
                  </Paper>
                </Grid>
              </Grid>
            )}
          </Paper>

          <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1} sx={{ mb: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>B. Category Performance</Typography>
              <Button variant="outlined" onClick={() => openSourceDialog('Data Sumber - Category Performance', categoryRows)} sx={sourceButtonSx}>
                Lihat Data Sumber
              </Button>
            </Stack>
            {categoryError && <Alert severity="warning" sx={{ mb: 2 }}>{categoryError}</Alert>}
            {categoryLoading ? (
              <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
            ) : categoryRows.length === 0 ? (
              <Alert severity="info">Belum ada data category performance pada periode ini.</Alert>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ width: '100%', minHeight: 280, overflowX: 'auto' }}>
                    <BarChart
                      width={560}
                      height={280}
                      data={categoryChartRows}
                      margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                      onClick={(state) => openSourceFromChartState('Detail Titik - Category Performance', state, categoryChartRows)}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(v)} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                      <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                        {categoryChartRows.map((row, idx) => (
                          <Cell key={`cat-${row.category}`} fill={chartColors[idx % chartColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Revenue</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Units</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Margin</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {categoryRows.map((row) => (
                          <TableRow key={row.category} hover>
                            <TableCell>{row.category}</TableCell>
                            <TableCell align="right">{formatCurrency(row.revenue)}</TableCell>
                            <TableCell align="right">{formatNumber(row.units)}</TableCell>
                            <TableCell align="right">{formatNumber(row.margin_pct)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            )}
          </Paper>

          <Box
            sx={{
              mb: 3,
              display: 'grid',
              gap: 2,
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              alignItems: 'stretch',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Paper sx={{ p: 2.5, borderRadius: 2.5, height: '100%', width: '100%' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1} sx={{ mb: 1.5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>C. Product Lifecycle</Typography>
                  <Button variant="outlined" onClick={() => openSourceDialog('Data Sumber - Product Lifecycle', lifecycleRows)} sx={sourceButtonSx}>
                    Lihat Data Sumber
                  </Button>
                </Stack>
                {lifecycleError && <Alert severity="warning" sx={{ mb: 2 }}>{lifecycleError}</Alert>}
                {lifecycleLoading ? (
                  <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
                ) : lifecycleChartRows.length === 0 ? (
                  <Alert severity="info">Belum ada data lifecycle.</Alert>
                ) : (
                  <Box sx={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={lifecycleChartRows}
                          dataKey="count"
                          nameKey="phase"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={95}
                          onClick={(entry) => openSourceDialog('Detail Titik - Product Lifecycle', [entry?.payload || entry])}
                        >
                          {lifecycleChartRows.map((row, idx) => (
                            <Cell key={`lc-${row.phase}`} fill={chartColors[idx % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => formatNumber(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </Paper>
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Paper sx={{ p: 2.5, borderRadius: 2.5, height: '100%', width: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>D. Lifecycle Breakdown</Typography>
                {lifecycleLoading ? (
                  <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Phase</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>SKU</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>%</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lifecycleRows.map((row) => (
                        <TableRow key={row.phase} hover>
                          <TableCell>{row.phase}</TableCell>
                          <TableCell align="right">{formatNumber(row.count)}</TableCell>
                          <TableCell align="right">{formatNumber(row.percent)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Box>
          </Box>

          <Box
            sx={{
              mb: 3,
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              alignItems: 'stretch',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Paper sx={{ p: 2.5, borderRadius: 2.5, height: '100%', width: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>E. Top Product</Typography>
                {performanceError && <Alert severity="warning" sx={{ mb: 2 }}>{performanceError}</Alert>}
                {performanceLoading ? (
                  <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
                ) : (
                  <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Revenue</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Margin</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {performanceData.top.map((row) => (
                        <TableRow key={`top-${row.item_id}`} hover>
                          <TableCell>
                            <Typography variant="body2" noWrap title={row.item_code || `ITEM-${row.item_id}`}>
                              {row.item_code || `ITEM-${row.item_id}`}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{formatCurrency(row.revenue)}</TableCell>
                          <TableCell align="right">{formatNumber(row.margin_pct)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Paper sx={{ p: 2.5, borderRadius: 2.5, height: '100%', width: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>F. Slow Product</Typography>
                {performanceLoading ? (
                  <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
                ) : (
                  <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>STR %</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Stock</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {performanceData.slow.map((row) => (
                        <TableRow key={`slow-${row.item_id}`} hover>
                          <TableCell>
                            <Typography variant="body2" noWrap title={row.item_code || `ITEM-${row.item_id}`}>
                              {row.item_code || `ITEM-${row.item_id}`}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{formatNumber(row.str_percent)}%</TableCell>
                          <TableCell align="right">{formatNumber(row.stock_qty)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Box>
          </Box>

        </>
      )}

      <Dialog open={sourceDialogOpen} onClose={() => setSourceDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{sourceDialogTitle}</DialogTitle>
        <DialogContent dividers>
          {sourceDialogRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Data sumber tidak tersedia.</Typography>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, width: 72 }} align="right">No</TableCell>
                      {sourceColumns.map((column) => (
                        <TableCell key={column} sx={{ fontWeight: 700 }} align={isNumericColumn(column) ? 'right' : 'left'}>
                          {sourceColumnLabel(column)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedSourceDialogRows.map((row, rowIndex) => (
                      <TableRow key={`source-row-${rowIndex}`} hover>
                        <TableCell align="right" sx={{ color: 'text.secondary' }}>
                          {formatNumber((sourceDialogPage * sourceDialogRowsPerPage) + rowIndex + 1)}
                        </TableCell>
                        {sourceColumns.map((column) => (
                          <TableCell key={`${rowIndex}-${column}`} align={isNumericColumn(column) ? 'right' : 'left'}>
                            {renderSourceValue(column, row?.[column])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}

                    {hasSourceTotals && (
                      <TableRow sx={{ backgroundColor: '#f8f8fb' }}>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                        {sourceColumns.map((column) => (
                          <TableCell key={`total-${column}`} align={isNumericColumn(column) ? 'right' : 'left'} sx={{ fontWeight: 700 }}>
                            {sourceTotals[column] == null
                              ? '-'
                              : (isCurrencyColumn(column)
                                ? formatCurrency(sourceTotals[column])
                                : formatNumber(sourceTotals[column]))}
                          </TableCell>
                        ))}
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={sourceDialogRows.length}
                page={sourceDialogPage}
                onPageChange={(_, nextPage) => setSourceDialogPage(nextPage)}
                rowsPerPage={sourceDialogRowsPerPage}
                onRowsPerPageChange={(event) => {
                  setSourceDialogRowsPerPage(parseInt(event.target.value, 10));
                  setSourceDialogPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
                labelRowsPerPage="Baris per halaman"
              />

              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Total data ditampilkan: {formatNumber(sourceDialogRows.length)} baris
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSourceDialogOpen(false)}>Tutup</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
