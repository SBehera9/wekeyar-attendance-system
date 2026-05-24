import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import StaffPortal from './pages/StaffPortal';
import AdminDashboard from './pages/AdminDashboard';
import AdminAttendance from './pages/AdminAttendance';
import AdminEmployees from './pages/AdminEmployees';
import AdminLocations from './pages/AdminLocations';
import AdminLeaveApprovals from './pages/AdminLeaveApprovals';
import AdminReports from './pages/AdminReports';

function AppRoutes() {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" />;

  const isStaff = user.role.toLowerCase() === 'staff';
  const isAdminOrHR = ['admin', 'hr', 'hr manager', 'accountant', 'manager', 'store in charge'].includes(user.role.toLowerCase());

  if (isStaff) {
    return <StaffPortal />;
  }

  if (isAdminOrHR) {
    return (
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/attendance" element={<AdminAttendance />} />
        <Route path="/employees" element={<AdminEmployees />} />
        <Route path="/locations" element={<AdminLocations />} />
        <Route path="/leaves" element={<AdminLeaveApprovals />} />
        <Route path="/reports" element={<AdminReports />} />
        <Route path="*" element={<AdminDashboard />} />
      </Routes>
    );
  }

  return <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<AppRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
