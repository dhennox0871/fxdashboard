import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './pages/DashboardLayout';
import DailyView from './pages/DailyView';
import AnnuallyView from './pages/AnnuallyView';
import AppearanceSettings from './pages/AppearanceSettings';
import LoginPage from './pages/LoginPage';
import { WidgetConfigProvider } from './context/WidgetConfigContext';
import { AuthProvider, useAuth } from './context/AuthContext';

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isLoggedIn } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isLoggedIn ? <Navigate to="/daily" replace /> : <LoginPage />} />
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/daily" replace />} />
          <Route path="daily" element={<DailyView />} />
          <Route path="annually" element={<AnnuallyView />} />
          <Route path="settings" element={<AppearanceSettings />} />
        </Route>
        <Route path="*" element={<Navigate to="/daily" replace />} />
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
