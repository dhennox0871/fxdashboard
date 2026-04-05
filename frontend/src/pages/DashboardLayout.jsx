import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Drawer, List, ListItem, ListItemIcon, ListItemText, IconButton, Box, Divider } from '@mui/material';
import Menu from '@mui/icons-material/Menu';
import CalendarToday from '@mui/icons-material/CalendarToday';
import InsertChart from '@mui/icons-material/InsertChart';
import Settings from '@mui/icons-material/Settings';
import Logout from '@mui/icons-material/Logout';
import Sync from '@mui/icons-material/Sync';
import { useAuth } from '../context/AuthContext';

const drawerWidth = 240;

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [companyName, setCompanyName] = useState('Memuat data...');
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, fetchWithAuth, user } = useAuth();

  React.useEffect(() => {
    fetchWithAuth('/api/settings/company')
      .then(res => res.json())
      .then(data => {
        if (data.company_name) setCompanyName(data.company_name);
      })
      .catch(() => setCompanyName('Gagal memuat data perusahaan'));
  }, []);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const navItems = [
    { text: 'Daily View', icon: <CalendarToday />, path: '/daily' },
    { text: 'Annually View', icon: <InsertChart />, path: '/annually' },
    { text: 'Appearance Settings', icon: <Settings />, path: '/settings' },
    { text: 'Synchronize Data', icon: <Sync />, path: '/sync' },
  ];

  const drawer = (
    <div>
      <Toolbar sx={{ flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', py: 3, borderBottom: '1px solid #f0f0f0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <img src="/logo.png" alt="Flexnote Logo" style={{ width: 24, height: 24, marginRight: 8, borderRadius: 6 }} />
          <Typography variant="h6" sx={{ fontWeight: 900, color: '#b66dff', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
            Flexnote Suites
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '0.2px', display: 'block', lineHeight: 1.2 }}>
          {companyName}
        </Typography>
      </Toolbar>
      <List>
        {navItems.map((item) => (
          <ListItem 
            button 
            key={item.text} 
            onClick={() => {
              navigate(item.path);
              setMobileOpen(false);
            }}
            selected={location.pathname === item.path}
            sx={{
              margin: '8px',
              borderRadius: '8px',
              '&.Mui-selected': {
                backgroundColor: 'rgba(182, 109, 255, 0.1)',
                color: '#b66dff',
                '& .MuiListItemIcon-root': {
                  color: '#b66dff',
                }
              }
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} sx={{fontWeight: location.pathname === item.path ? 'bold' : 'normal'}} />
          </ListItem>
        ))}
      </List>
      <Box sx={{ flexGrow: 1 }} />
      <Divider />
      {user?.database && (
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', py: 1, color: '#b66dff', fontWeight: 700, letterSpacing: '0.5px' }}>
          DB: {user.database}
        </Typography>
      )}
      <List>
        <ListItem
          button
          onClick={() => { logout(); navigate('/login'); }}
          sx={{ margin: '8px', borderRadius: '8px', color: '#999' }}
        >
          <ListItemIcon sx={{color: '#999'}}><Logout /></ListItemIcon>
          <ListItemText primary={`Logout${user ? ' (' + user.username + ')' : ''}`} />
        </ListItem>
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ width: { sm: `calc(100% - ${drawerWidth}px)` }, ml: { sm: `${drawerWidth}px` }, backgroundColor: 'white', color: 'text.primary', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: 'none' } }}>
            <Menu />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{fontWeight: 'bold'}}>
            {navItems.find(i => i.path === location.pathname)?.text || 'Dashboard'}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={handleDrawerToggle} ModalProps={{ keepMounted: true }} sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth } }}>
          {drawer}
        </Drawer>
        <Drawer variant="permanent" sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: 'none', boxShadow: '2px 0 10px rgba(0,0,0,0.02)' } }} open>
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` }, mt: 8 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
