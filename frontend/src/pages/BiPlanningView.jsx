import React from 'react';
import {
  Alert,
  Box,
  Chip,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AutoGraph from '@mui/icons-material/AutoGraph';
import Inventory2 from '@mui/icons-material/Inventory2';
import Sell from '@mui/icons-material/Sell';

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
    status: 'Partial',
    needed: 'COGS/HPP per SKU and net margin per order line',
    source: 'Need additional fields or table from ERP',
  },
  {
    area: 'Inventory Snapshot',
    status: 'Missing',
    needed: 'Current stock by SKU and channel',
    source: 'Need stock ledger/inventory table',
  },
  {
    area: 'Inventory Aging',
    status: 'Missing',
    needed: 'Inbound date or last movement date per SKU batch',
    source: 'Need stock movement history table',
  },
  {
    area: 'Channel Attribution',
    status: 'Missing',
    needed: 'Sales channel flag per order (Shopee/TikTok/etc)',
    source: 'Need channel field in transactions',
  },
  {
    area: 'Campaign ROI',
    status: 'Missing',
    needed: 'Campaign cost, discount value, campaign ID linkage to orders',
    source: 'Need promo/campaign master and transaction relation',
  },
  {
    area: 'Cancellation Quality',
    status: 'Missing',
    needed: 'Cancel status and cancel reason per order',
    source: 'Need order status history table',
  },
  {
    area: 'Size Performance',
    status: 'Partial',
    needed: 'Variant/size per SKU with sold and stock quantities',
    source: 'Need variant dimension and stock by size',
  },
];

function statusColor(status) {
  if (status === 'Ready') return 'success';
  if (status === 'Partial') return 'warning';
  return 'default';
}

export default function BiPlanningView() {
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
