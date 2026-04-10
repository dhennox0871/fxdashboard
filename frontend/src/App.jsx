import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './pages/DashboardLayout';
import DailyView from './pages/DailyView';
import AnnuallyView from './pages/AnnuallyView';
import AppearanceSettings from './pages/AppearanceSettings';
import LoginPage from './pages/LoginPage';
import SyncPage from './pages/SyncPage';
import DatabaseManagementPage from './pages/DatabaseManagementPage';
import BiPlanningView from './pages/BiPlanningView';
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
          <Route path="bi-planning" element={<BiPlanningView />} />
          <Route path="settings" element={<AppearanceSettings />} />
          <Route path="sync" element={<SyncPage />} />
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
