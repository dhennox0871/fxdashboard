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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AutoGraph from '@mui/icons-material/AutoGraph';
import Inventory2 from '@mui/icons-material/Inventory2';
import Sell from '@mui/icons-material/Sell';
import Refresh from '@mui/icons-material/Refresh';
import { useAuth } from '../context/AuthContext';

const reportBlocks = [
  {
    title: 'Owner Executive',
    icon: <AutoGraph color="primary" />,
    items: ['KPI cards (Revenue, Orders, AOV, Margin)', 'Revenue trend (line/area)', 'Channel contribution (bar/pie)', 'Business health alert table'],
  },
  {
    title: 'Ops & Inventory',
    icon: <Inventory2 color="primary" />,
    items: ['Inventory KPI (stock, value, DOI)', 'Inventory health table (DOI status)', 'Low & Out of stock alert', 'Inventory aging bucket'],
  },
  {
    title: 'Product & Sales',
    icon: <Sell color="primary" />,
    items: ['Category performance', 'Product lifecycle table', 'Top & slow product list', 'Promo impact and ROI'],
  },
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
    source: 'masteritemuom linked by itemid',
  },
];

function statusColor(status) {
  if (status === 'Ready') return 'success';
  if (status === 'Partial') return 'warning';
  return 'default';
}

export default function BiPlanningView() {
  const { fetchWithAuth } = useAuth();
  const [days, setDays] = useState(30);
  const [scope, setScope] = useState('global');
  const [doiRows, setDoiRows] = useState([]);
  const [loadingDOI, setLoadingDOI] = useState(true);
  const [doiError, setDoiError] = useState('');

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

  const formatNumber = (value) => {
    const n = Number(value || 0);
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
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
        Saran nama menu: BI Planning. Tujuannya sebagai ruang perencanaan report tanpa mengganggu Daily dan Annually yang sudah aktif.
      </Alert>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {reportBlocks.map((block) => (
          <Grid item xs={12} md={4} key={block.title}>
            <Paper sx={{ p: 2.5, borderRadius: 2.5, height: '100%' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                {block.icon}
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{block.title}</Typography>
              </Stack>
              <Stack spacing={1}>
                {block.items.map((item) => (
                  <Typography key={item} variant="body2" color="text.secondary">- {item}</Typography>
                ))}
              </Stack>
            </Paper>
          </Grid>
        ))}
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
                    <TableCell colSpan={7}>
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
    </Box>
  );
}
