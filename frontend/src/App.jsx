import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './pages/DashboardLayout';
import DailyView from './pages/DailyView';
import AnnuallyView from './pages/AnnuallyView';
import AppearanceSettings from './pages/AppearanceSettings';
import LoginPage from './pages/LoginPage';
import SyncPage from './pages/SyncPage';
import DatabaseManagementPage from './pages/DatabaseManagementPage';
import BiPlanningView from './pages/BiPlanningView';
import ManageUsersPage from './pages/ManageUsersPage';
import { WidgetConfigProvider } from './context/WidgetConfigContext';
import { AuthProvider, useAuth } from './context/AuthContext';

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function ManagementRoute({ children }) {
  const { isLoggedIn, user } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return user?.role === 'superadmin' ? children : <Navigate to="/daily" replace />;
}

function NonManagementRoute({ children }) {
  const { isLoggedIn, user } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return user?.role === 'superadmin' ? <Navigate to="/db-management" replace /> : children;
}

function MenuAllowedRoute({ menuKey, children }) {
  const { isLoggedIn, user } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (user?.role === 'superadmin') return children;

  const allowedMenus = Array.isArray(user?.menu_access) ? user.menu_access : [];
  const isMasterAdmin = !!user?.is_masteradmin;
  if (isMasterAdmin) return children;
  return allowedMenus.includes(menuKey) ? children : <Navigate to="/daily" replace />;
}

function AppRoutes() {
  const { isLoggedIn, user } = useAuth();
  const defaultPath = user?.role === 'superadmin' ? '/db-management' : '/daily';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isLoggedIn ? <Navigate to={defaultPath} replace /> : <LoginPage />} />
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to={defaultPath} replace />} />
          <Route path="daily" element={<DailyView />} />
          <Route path="annually" element={<AnnuallyView />} />
          <Route path="bi-planning" element={<NonManagementRoute><BiPlanningView /></NonManagementRoute>} />
          <Route path="settings" element={<AppearanceSettings />} />
          <Route path="sync" element={<SyncPage />} />
          <Route path="manage-users" element={<MenuAllowedRoute menuKey="manage-users"><ManageUsersPage /></MenuAllowedRoute>} />
          <Route path="db-management" element={<ManagementRoute><DatabaseManagementPage /></ManagementRoute>} />
        </Route>
        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <WidgetConfigProvider>
        <AppRoutes />
      </WidgetConfigProvider>
    </AuthProvider>
  );
}

export default App;
