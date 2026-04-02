import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { TrendingUp, ShoppingBag, LayoutGrid as Category, Building as Business, User as Person } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function DashboardCard({ config, data, nameKey, valKey }) {
  if (!config.isVisible) return null;

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

  const renderKPI = () => (
    <Paper sx={{
      background: `linear-gradient(to right, ${cTheme.start}, ${cTheme.end})`,
      borderRadius: '10px', color: 'white', p: 3.5, position: 'relative', overflow: 'hidden', mb: 3,
      boxShadow: `0 8px 20px ${cTheme.end}30`
    }}>
      <Box sx={{ position: 'absolute', right: -20, bottom: -20, pointerEvents: 'none' }}>
        {getIcon(config.id)}
      </Box>
      <Typography variant="subtitle1" sx={{ opacity: 0.9, fontWeight: 600 }}>{config.title}</Typography>
      <Typography variant="h4" sx={{ fontWeight: 'bold', my: 1.5 }}>{config.id.includes('order') ? data?.total_orders || 0 : formatCurrency(data?.total_sales || 0)}</Typography>
      <Box sx={{ backgroundColor: 'rgba(255,255,255,0.2)', py: 0.5, px: 2, borderRadius: 10, display: 'inline-block', mt: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>Periode Terpilih</Typography>
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
    const pieData = Array.isArray(data) ? data.slice(0, 5) : [];
    const COLORS = ['#fe7096', '#9a55ff', '#047edf', '#07cdae', '#FFC107'];
    
    return (
      <Paper sx={{ p: 3.5, borderRadius: '10px', mb: 3, boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>{config.title}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', height: 200 }}>
          <ResponsiveContainer width="50%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey={valKey} nameKey={nameKey} innerRadius={45} outerRadius={80} stroke="none">
                {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <Box sx={{ width: '50%', pl: 2 }}>
            {pieData.map((item, idx) => (
              <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLORS[idx], mr: 1.5 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary', maxWidth: 90, noWrap: true, textOverflow: 'ellipsis', overflow: 'hidden', fontWeight: 500 }}>{item[nameKey]}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Paper>
    );
  };

  const renderBarChart = () => {
    const barData = Array.isArray(data) ? data.slice(0, 5) : [];
    return (
      <Paper sx={{ p: 3.5, borderRadius: '10px', mb: 3, boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 3 }}>{config.title}</Typography>
        <Box sx={{ height: 220, mt: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <XAxis dataKey={nameKey} axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#aaa'}} />
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
    return (
      <Paper sx={{ p: 3.5, borderRadius: '10px', mb: 3, boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{config.title}</Typography>
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
            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
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
              <XAxis dataKey="tgl" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#aaa'}} tickFormatter={(v) => v ? v.substring(5, 10) : ''} />
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

  switch (displayType) {
    case 'kpi': return renderKPI();
    case 'top_list': return renderTopList();
    case 'pie_chart': return renderPieChart();
    case 'bar_chart': return renderBarChart();
    case 'area_chart': return renderAreaChart();
    case 'list': return renderRecentList();
    default: return null;
  }
}
