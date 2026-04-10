import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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

const ownerSections = [
  'A. KPI cards (sudah live)',
  'B. Revenue trend (line chart)',
  'C. Channel contribution (bar/pie dari costcenter)',
  'D. Business health alert (stock/cancel/margin)',
  'E. Product snapshot (Top 5 dan Bottom 5 SKU)',
];

const opsSections = [
  'A. Inventory KPI (Total SKU, Total Stock, Inventory Value, DOI)',
  'B. Inventory Health core table (sudah live DOI simulator)',
  'C. Low & out of stock alert',
  'D. Inventory aging (pending, menunggu movement data)',
  'E. Size/dimensi performance',
];

const productSections = [
  'A. Sales KPI (Revenue, Units, Avg Margin, Sell-through)',
  'B. Category performance',
  'C. Product lifecycle',
  'D. Top & slow product',
  'E. Promo impact (ditunda)',
];

const dataChecklist = [
  {
    area: 'Sales Core',
    status: 'Ready',
    needed: 'Revenue, orders, date trend, category and cashier split',
    source: 'logtrans, logtransline, masteritemgroup, mastercostcenter, masterrepresentative',
  },
  {
    area: 'SKU Level Margin',
    status: 'Ready',
    needed: 'HPP per line, total HPP, gross value (netvalue)',
    source: 'logtransline.hpp, logtransline.totalhpp, logtransline.netvalue',
  },
  {
    area: 'Inventory Snapshot',
    status: 'Ready',
    needed: 'Stock by item and warehouse (debet-credit)',
    source: 'stockview + masterwarehouse + masteritem',
  },
  {
    area: 'Inventory Aging',
    status: 'Missing',
    needed: 'Inbound date or last movement date per SKU batch',
    source: 'Need stock movement history table',
  },
  {
    area: 'Channel Attribution',
    status: 'Ready',
    needed: 'Channel contribution by cost center',
    source: 'logtrans.costcenterid + mastercostcenter',
  },
  {
    area: 'Campaign ROI',
    status: 'Missing',
    needed: 'Campaign cost, discount value, campaign ID linkage to orders',
    source: 'Need promo/campaign master and transaction relation',
  },
  {
    area: 'Cancellation Quality',
    status: 'Partial',
    needed: 'Retur/cancel quantity from transaction type',
    source: 'transtypeid 11 and 19 in logtrans/logtransline',
  },
  {
    area: 'Size Performance',
    status: 'Ready',
    needed: 'Dimensi produk (length/width/depth/height/weight/volume)',
    source: 'masteritemuom linked by itemid, base UOM from masteritem.uomid -> masteruom',
  },
];

function statusColor(status) {
  if (status === 'Ready') return 'success';
  if (status === 'Partial') return 'warning';
  return 'default';
}

export default function BiPlanningView() {
  const { fetchWithAuth } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [kpiPeriod, setKpiPeriod] = useState('mtd');
  const [kpiData, setKpiData] = useState(null);
  const [loadingKPI, setLoadingKPI] = useState(true);
  const [kpiError, setKpiError] = useState('');
  const [days, setDays] = useState(30);
  const [scope, setScope] = useState('global');
  const [doiRows, setDoiRows] = useState([]);
  const [loadingDOI, setLoadingDOI] = useState(true);
  const [doiError, setDoiError] = useState('');

  const fetchExecutiveKPI = async () => {
    setLoadingKPI(true);
    setKpiError('');
    try {
      const res = await fetchWithAuth(`/api/bi/executive-kpi?period=${kpiPeriod}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat KPI executive');
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data DOI');
      setDoiRows(data.rows || []);
    } catch (err) {
      setDoiError(err.message || 'Gagal memuat data DOI');
      setDoiRows([]);
    } finally {
      setLoadingDOI(false);
    }
  };

  useEffect(() => {
    fetchDOI();
  }, [days, scope]);

  useEffect(() => {
    fetchExecutiveKPI();
  }, [kpiPeriod]);

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

  const statusChipColor = (status) => {
    if (status === 'Urgent') return 'error';
    if (status === 'Waspada') return 'warning';
    if (status === 'Normal') return 'success';
    if (status === 'Out of Stock') return 'default';
    return 'default';
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>BI Planning Workspace</Typography>
        <Typography variant="body2" color="text.secondary">
          Area ini dipisahkan dari dashboard berjalan. Fokus untuk menyiapkan model laporan baru berdasarkan dokumen mockup BI.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        BI Planning dipisah dari dashboard utama. Di bawah ini dibagi 3 tab sesuai PDF: Owner, Ops & Inventory, Product & Sales.
      </Alert>

      <Paper sx={{ mb: 3, borderRadius: 2.5 }}>
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
          <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Roadmap Owner Dashboard</Typography>
            <Stack spacing={0.8}>
              {ownerSections.map((item) => (
                <Typography key={item} variant="body2" color="text.secondary">- {item}</Typography>
              ))}
            </Stack>
          </Paper>

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
                <Typography variant="body2" color="text.secondary">Letak paling atas, 1 baris. Toggle Today / MTD.</Typography>
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
                  MTD
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
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Revenue {kpiPeriod.toUpperCase()}</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatCurrency(kpiData?.revenue)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={2}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Orders {kpiPeriod.toUpperCase()}</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatNumber(kpiData?.orders)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={2}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Units Sold</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatNumber(kpiData?.units_sold)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={2}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Gross Profit</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatCurrency(kpiData?.gross_profit)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={2}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Gross Margin %</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {formatNumber(kpiData?.gross_margin)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">Target {'>='} 40%</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={2}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">AOV</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatCurrency(kpiData?.aov)}</Typography>
                  </Paper>
                </Grid>
              </Grid>
            )}
          </Paper>
        </>
      )}

      {activeTab === 1 && (
        <>
          <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Roadmap Ops & Inventory</Typography>
            <Stack spacing={0.8}>
              {opsSections.map((item) => (
                <Typography key={item} variant="body2" color="text.secondary">- {item}</Typography>
              ))}
            </Stack>
          </Paper>

          <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>DOI Simulator</Typography>
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
                {doiRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography variant="body2" color="text.secondary">Belum ada data DOI yang dapat ditampilkan.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  doiRows.slice(0, 200).map((row) => (
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
          </TableContainer>
        )}
          </Paper>
        </>
      )}

      {activeTab === 2 && (
        <>
          <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Roadmap Product & Sales</Typography>
            <Stack spacing={0.8}>
              {productSections.map((item) => (
                <Typography key={item} variant="body2" color="text.secondary">- {item}</Typography>
              ))}
            </Stack>
          </Paper>

          <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Data Checklist Yang Perlu Anda Info-kan</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Tabel berikut menunjukkan kesiapan data saat ini dan tambahan data yang dibutuhkan agar model report BI bisa lengkap.
        </Typography>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Area Data</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Data Diperlukan</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Sumber / Info yang Dibutuhkan</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dataChecklist.map((row) => (
                <TableRow key={row.area} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{row.area}</TableCell>
                  <TableCell>
                    <Chip size="small" color={statusColor(row.status)} label={row.status} />
                  </TableCell>
                  <TableCell>{row.needed}</TableCell>
                  <TableCell>{row.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  );
}
