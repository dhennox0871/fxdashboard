import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import { TrendingUp, ShoppingBag, LayoutGrid as Category, Building as Business, User as Person } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function DashboardCard({ config, data, nameKey, valKey, sourceProvider }) {
  if (!config.isVisible) return null;

  const [sourceDialogOpen, setSourceDialogOpen] = React.useState(false);
  const [sourceDialogTitle, setSourceDialogTitle] = React.useState('Data Sumber');
  const [sourceRows, setSourceRows] = React.useState([]);
  const [sourceLoading, setSourceLoading] = React.useState(false);
  const [sourceError, setSourceError] = React.useState('');
  const [sourceSummary, setSourceSummary] = React.useState({ total_orders: 0, total_revenue: 0, assembly_qty: 0 });
  const [sourcePage, setSourcePage] = React.useState(0);
  const [sourceRowsPerPage, setSourceRowsPerPage] = React.useState(10);

  const getColors = (theme) => {
    switch (theme) {
      case 'orange': return { start: '#ffbf96', end: '#fe7096', icon: 'rgba(255,255,255,0.2)' };
      case 'teal': return { start: '#84d9d2', end: '#07cdae', icon: 'rgba(255,255,255,0.2)' };
      case 'blue': return { start: '#90caf9', end: '#047edf', icon: 'rgba(255,255,255,0.2)' };
      case 'purple': return { start: '#da8cff', end: '#9a55ff', icon: 'rgba(255,255,255,0.2)' };
      case 'green': return { start: '#81C784', end: '#43A047', icon: 'rgba(255,255,255,0.2)' };
      case 'red': return { start: '#ff9a9e', end: '#fecfef', icon: 'rgba(255,255,255,0.2)' };
      default: return { start: '#B0BEC5', end: '#78909C', icon: 'rgba(255,255,255,0.2)' };
    }
  };

  const getIcon = (id) => {
    if (id.includes('revenue')) return <TrendingUp size={120} color="rgba(255,255,255,0.15)" strokeWidth={1} />;
    if (id.includes('orders')) return <ShoppingBag size={120} color="rgba(255,255,255,0.15)" strokeWidth={1} />;
    if (id.includes('group')) return <Category size={120} color="rgba(255,255,255,0.15)" strokeWidth={1} />;
    if (id.includes('costcenter')) return <Business size={120} color="rgba(255,255,255,0.15)" strokeWidth={1} />;
    if (id.includes('cashier')) return <Person size={120} color="rgba(255,255,255,0.15)" strokeWidth={1} />;
    return <TrendingUp size={120} color="rgba(255,255,255,0.15)" strokeWidth={1} />;
  };

  const cTheme = getColors(config.colorTheme);

  const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(val || 0));

  const toRows = (input) => {
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
    const normalizedRows = toRows(rows);
    const computedRevenue = normalizedRows.reduce((acc, row) => {
      const baseValue = row?.nilai_rupiah ?? row?.total ?? row?.value;
      const numeric = Number(baseValue);
      if (Number.isFinite(numeric)) return acc + numeric;

      const tunai = Number(row?.tunai ?? 0);
      const kredit = Number(row?.kredit ?? 0);
      if (Number.isFinite(tunai) || Number.isFinite(kredit)) {
        return acc + (Number.isFinite(tunai) ? tunai : 0) + (Number.isFinite(kredit) ? kredit : 0);
      }

      return acc;
    }, 0);

    setSourceDialogTitle(title || 'Data Sumber');
    setSourceRows(normalizedRows);
    setSourceError('');
    setSourceSummary({ total_orders: normalizedRows.length, total_revenue: computedRevenue });
    setSourcePage(0);
    setSourceDialogOpen(true);
  };

  const openSourceDialogAsync = async (title, contextRow = null) => {
    if (typeof sourceProvider !== 'function') {
      openSourceDialog(title, contextRow ? [contextRow] : []);
      return;
    }

    setSourceDialogTitle(title || 'Data Sumber');
    setSourceDialogOpen(true);
    setSourceLoading(true);
    setSourceError('');
    setSourcePage(0);

    try {
      const result = await sourceProvider({ contextRow, configId: config.id });
      const rows = toRows(result?.rows || []);
      const summary = result?.summary || {};

      const fallbackRevenue = rows.reduce((acc, row) => {
        const value = Number(row?.nilai_rupiah ?? row?.total ?? row?.value ?? 0);
        return acc + (Number.isFinite(value) ? value : 0);
      }, 0);

      setSourceRows(rows);
      setSourceSummary({
        total_orders: Number(summary.total_orders ?? rows.length),
        total_revenue: Number(summary.total_revenue ?? fallbackRevenue),
        assembly_qty: Number(summary.assembly_qty ?? 0),
      });
    } catch (err) {
      setSourceRows([]);
      setSourceSummary({ total_orders: 0, total_revenue: 0, assembly_qty: 0 });
      setSourceError(err?.message || 'Gagal memuat data sumber.');
    } finally {
      setSourceLoading(false);
    }
  };

  const pagedSourceRows = React.useMemo(() => {
    const start = sourcePage * sourceRowsPerPage;
    return sourceRows.slice(start, start + sourceRowsPerPage);
  }, [sourceRows, sourcePage, sourceRowsPerPage]);

  const isNumericColumn = React.useCallback((column) => (
    column === 'nilai_rupiah' ||
    column === 'total' ||
    column === 'tunai' ||
    column === 'kredit' ||
    column === 'total_orders' ||
    column.includes('amount') ||
    column.includes('total')
  ), []);

  const sourceColumns = React.useMemo(() => {
    if (sourceRows.length === 0) return [];
    const keys = new Set();
    sourceRows.forEach((row) => {
      Object.keys(row || {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [sourceRows]);

  const hasNomorNotaColumn = React.useMemo(
    () => sourceColumns.includes('nomor_nota') || sourceColumns.includes('logtransentrytext'),
    [sourceColumns],
  );

  const renderSourceButton = (title, rows, contextRow = null) => (
    <Button
      size="small"
      variant="outlined"
      onClick={() => {
        if (typeof sourceProvider === 'function') {
          openSourceDialogAsync(title, contextRow);
          return;
        }
        openSourceDialog(title, rows);
      }}
      sx={{
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
      }}
    >
      Lihat Data Sumber
    </Button>
  );

  const openSourceFromChartState = (title, state, fallbackRows) => {
    const payloadRow = state?.activePayload?.[0]?.payload;
    if (typeof sourceProvider === 'function') {
      openSourceDialogAsync(title, payloadRow || null);
      return;
    }
    if (payloadRow && typeof payloadRow === 'object') {
      openSourceDialog(title, [payloadRow]);
      return;
    }
    if (fallbackRows) {
      openSourceDialog(title, fallbackRows);
    }
  };

  const renderKPI = () => (
    <Paper sx={{
      background: `linear-gradient(to right, ${cTheme.start}, ${cTheme.end})`,
      borderRadius: '10px', color: 'white', p: 3.5, position: 'relative', overflow: 'hidden', mb: 3,
      boxShadow: `0 8px 20px ${cTheme.end}30`
    }}>
      <Box sx={{ position: 'absolute', right: -20, bottom: -20, pointerEvents: 'none' }}>
        {getIcon(config.id)}
      </Box>
      <Typography variant="subtitle2" sx={{ opacity: 0.9, fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>{config.title}</Typography>
      <Typography variant="h4" sx={{ fontWeight: 'bold', my: { xs: 1, sm: 1.5 }, fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>{config.id.includes('order') ? data?.total_orders || 0 : formatCurrency(data?.total_sales || 0)}</Typography>
      <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ fontWeight: 600, opacity: 0.9 }}>
          Periode terpilih
        </Typography>
        {typeof sourceProvider === 'function' && renderSourceButton(`Data Sumber - ${config.title}`, [], null)}
      </Box>
    </Paper>
  );

  const renderTopList = () => {
    const listData = Array.isArray(data) ? data.slice(0, 5) : [];
    return (
      <Paper sx={{
        background: `linear-gradient(to right, ${cTheme.start}, ${cTheme.end})`,
        borderRadius: '10px', color: 'white', p: 3.5, position: 'relative', overflow: 'hidden', mb: 3,
        boxShadow: `0 8px 20px ${cTheme.end}30`
      }}>
        <Box sx={{ position: 'absolute', right: -20, bottom: -20, pointerEvents: 'none' }}>
          {getIcon(config.id)}
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 3, zIndex: 1, position: 'relative' }}>{config.title}</Typography>
        {listData.map((item, idx) => (
          <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, zIndex: 1, position: 'relative' }}>
            <Typography variant="body2" sx={{ fontWeight: 500, opacity: 0.9 }}>{item[nameKey]}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{formatCurrency(item[valKey])}</Typography>
          </Box>
        ))}
      </Paper>
    );
  };

  const renderPieChart = () => {
    const fullData = Array.isArray(data) ? data : [];
    const pieData = fullData.slice(0, 5);
    const COLORS = ['#fe7096', '#9a55ff', '#047edf', '#07cdae', '#FFC107'];
    
    return (
      <Paper sx={{ p: 3.5, borderRadius: '10px', mb: 3, boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{config.title}</Typography>
          {renderSourceButton(`Data Sumber - ${config.title}`, fullData)}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', minHeight: { xs: 350, md: 200 } }}>
          <ResponsiveContainer width={ { xs: '100%', md: '50%' } } height={ { xs: 200, md: '100%' } }>
            <PieChart>
              <Pie
                data={pieData}
                dataKey={valKey}
                nameKey={nameKey}
                innerRadius={45}
                outerRadius={80}
                stroke="none"
                onClick={(entry) => {
                  const row = entry?.payload || entry;
                  if (typeof sourceProvider === 'function') {
                    openSourceDialogAsync(`Detail Titik - ${config.title}`, row);
                    return;
                  }
                  openSourceDialog(`Detail Titik - ${config.title}`, [row]);
                }}
              >
                {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <Box sx={{ width: { xs: '100%', md: '50%' }, pl: { xs: 0, md: 2 }, mt: { xs: 2, md: 0 } }}>
            {pieData.map((item, idx) => (
              <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLORS[idx], mr: 1.5 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary', maxWidth: { xs: 200, md: 90 }, noWrap: true, textOverflow: 'ellipsis', overflow: 'hidden', fontWeight: 500 }}>{item[nameKey]}</Typography>
                </Box>
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>{formatCurrency(item[valKey])}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Paper>
    );
  };

  const renderBarChart = () => {
    const barData = Array.isArray(data) ? data : [];
    return (
      <Paper sx={{ p: 3.5, borderRadius: '10px', mb: 3, boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{config.title}</Typography>
          {renderSourceButton(`Data Sumber - ${config.title}`, barData)}
        </Box>
        <Box sx={{ height: 220, mt: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} onClick={(state) => openSourceFromChartState(`Detail Titik - ${config.title}`, state, barData)}>
              <XAxis dataKey={nameKey} axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#aaa'}} interval={0} />
              <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} formatter={(value) => formatCurrency(value)} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.1)'}} />
              <Bar dataKey={valKey} fill={`url(#colorBar${config.id})`} radius={[6, 6, 0, 0]} barSize={25} />
              <defs>
                <linearGradient id={`colorBar${config.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cTheme.start} stopOpacity={1}/>
                  <stop offset="100%" stopColor={cTheme.end} stopOpacity={1}/>
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Paper>
    );
  };

  const renderAreaChart = () => {
    const chartData = Array.isArray(data) ? data : [];
    const xAxisKey = chartData.length > 0
      ? (chartData[0].tgl !== undefined ? 'tgl' : (chartData[0].name !== undefined ? 'name' : 'bulan'))
      : 'tgl';
    const xTickFormatter = (v) => {
      if (xAxisKey === 'tgl') return v ? v.substring(5, 10) : '';
      return v ?? '';
    };
    return (
      <Paper sx={{ p: 3.5, borderRadius: '10px', mb: 3, boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{config.title}</Typography>
          {renderSourceButton(`Data Sumber - ${config.title}`, chartData)}
          {chartData.length > 0 && chartData[0].kredit !== undefined && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#07cdae' }} />
                <Typography variant="caption" color="textSecondary" fontWeight={500}>Tunai</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#9a55ff' }} />
                <Typography variant="caption" color="textSecondary" fontWeight={500}>Kredit</Typography>
              </Box>
            </Box>
          )}
        </Box>
        <Box sx={{ height: 260, mt: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
              onClick={(state) => openSourceFromChartState(`Detail Titik - ${config.title}`, state, chartData)}
            >
              <defs>
                <linearGradient id="colorTunai" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#07cdae" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#07cdae" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorKredit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9a55ff" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#9a55ff" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id={`colorTotal${config.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={cTheme.end} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={cTheme.end} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#aaa'}} tickFormatter={xTickFormatter} />
              <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.1)'}} />
              {chartData.length > 0 && chartData[0].kredit !== undefined ? (
                <>
                  <Area type="monotone" dataKey="tunai" stroke="#07cdae" strokeWidth={3} fillOpacity={1} fill="url(#colorTunai)" />
                  <Area type="monotone" dataKey="kredit" stroke="#9a55ff" strokeWidth={3} fillOpacity={1} fill="url(#colorKredit)" />
                </>
              ) : (
                <Area type="monotone" dataKey="total" stroke={cTheme.end} strokeWidth={3} fillOpacity={1} fill={`url(#colorTotal${config.id})`} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </Paper>
    );
  };

  const renderRecentList = () => {
    const recents = Array.isArray(data) ? data : [];
    return (
      <Paper sx={{ p: 3.5, borderRadius: '10px', mb: 3, boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>{config.title}</Typography>
        {recents.map((item, idx) => (
          <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', py: 2, borderBottom: idx < recents.length - 1 ? '1px solid #f8f9fa' : 'none' }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{item.logtransentrytext}</Typography>
              <Typography variant="caption" color="textSecondary">{item.sales_name} • {item.entrydate}</Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#333' }}>{formatCurrency(item.total)}</Typography>
              <Box sx={{
                display: 'inline-block', px: 1, py: 0.2, mt: 0.5, borderRadius: 2,
                backgroundColor: item.transtypeid === 18 ? 'rgba(7, 205, 174, 0.1)' : 'rgba(154, 85, 255, 0.1)',
                color: item.transtypeid === 18 ? '#07cdae' : '#9a55ff', fontSize: 10, fontWeight: 'bold'
              }}>
                {item.transtypeid === 18 ? 'TUNAI' : 'KREDIT'}
              </Box>
            </Box>
          </Box>
        ))}
      </Paper>
    );
  }

  // Adjust display fallback for AreaChart since the user selected line_chart previously
  const displayType = config.displayType === 'line_chart' ? 'area_chart' : config.displayType;

  let content = null;
  switch (displayType) {
    case 'kpi':
      content = renderKPI();
      break;
    case 'top_list':
      content = renderTopList();
      break;
    case 'pie_chart':
      content = renderPieChart();
      break;
    case 'bar_chart':
      content = renderBarChart();
      break;
    case 'area_chart':
      content = renderAreaChart();
      break;
    case 'list':
      content = renderRecentList();
      break;
    default:
      content = null;
      break;
  }

  return (
    <>
      {content}

      <Dialog open={sourceDialogOpen} onClose={() => setSourceDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{sourceDialogTitle}</DialogTitle>
        <DialogContent dividers>
          {sourceLoading ? (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={26} />
            </Box>
          ) : sourceError ? (
            <Typography variant="body2" color="error">{sourceError}</Typography>
          ) : sourceRows.length === 0 ? (
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
                          {column === 'nomor_nota' ? 'Nomor Nota' :
                            column === 'tanggal' ? 'Tanggal' :
                            column === 'nilai_rupiah' ? 'Nilai (Rp)' :
                            column}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedSourceRows.map((row, rowIndex) => (
                      <TableRow key={`source-row-${rowIndex}`} hover>
                        <TableCell align="right" sx={{ color: 'text.secondary' }}>
                          {formatNumber((sourcePage * sourceRowsPerPage) + rowIndex + 1)}
                        </TableCell>
                        {sourceColumns.map((column) => {
                          const value = row?.[column];
                          const isCurrency = column === 'nilai_rupiah' || column === 'total' || column === 'tunai' || column === 'kredit';
                          const isNumeric = typeof value === 'number' || (!Number.isNaN(Number(value)) && value !== null && value !== '');

                          return (
                            <TableCell key={`${rowIndex}-${column}`} align={isCurrency || isNumericColumn(column) ? 'right' : 'left'}>
                              {isCurrency
                                ? formatCurrency(value)
                                : isNumeric
                                  ? formatNumber(value)
                                  : String(value ?? '-')}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={sourceRows.length}
                page={sourcePage}
                onPageChange={(_, nextPage) => setSourcePage(nextPage)}
                rowsPerPage={sourceRowsPerPage}
                onRowsPerPageChange={(event) => {
                  setSourceRowsPerPage(parseInt(event.target.value, 10));
                  setSourcePage(0);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
                labelRowsPerPage="Baris per halaman"
              />

              <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Total data ditampilkan: {formatNumber(sourceRows.length)} baris
                </Typography>
                <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {hasNomorNotaColumn ? 'Total Nota' : 'Total Item'}: {formatNumber(sourceRows.length)}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Total Revenue: {formatCurrency(sourceSummary.total_revenue)}
                  </Typography>
                  {Number(sourceSummary.assembly_qty || 0) > 0 && (
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Qty Komponen (47): {formatNumber(sourceSummary.assembly_qty)}
                    </Typography>
                  )}
                </Box>
              </Box>

              {sourceSummary.total_orders !== sourceRows.length && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block', textAlign: 'right' }}>
                  Total Order KPI: {formatNumber(sourceSummary.total_orders)} (sesuai perhitungan kartu KPI)
                </Typography>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSourceDialogOpen(false)}>Tutup</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
