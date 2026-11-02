import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Profile from './pages/Profile';
import WorkerHome from './pages/WorkerHome';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Entries from './pages/Entries';
import Requests from './pages/Requests';
import CashClosing from './pages/CashClosing';
import Reports from './pages/Reports';
import Workers from './pages/Workers';
import AuditLog from './pages/AuditLog';
import LoginApprovals from './pages/LoginApprovals';

function Protected({ children, admin }) {
  const { user, checking } = useAuth();
  if (checking) return <Spinner className="min-h-screen items-center" />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  return user.role === 'admin' ? <Dashboard /> : <WorkerHome />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Home />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="entries" element={<Protected admin><Entries /></Protected>} />
        <Route path="requests" element={<Requests />} />
        <Route path="cash" element={<CashClosing />} />
        <Route path="profile" element={<Profile />} />
        <Route path="reports" element={<Protected admin><Reports /></Protected>} />
        <Route path="workers" element={<Protected admin><Workers /></Protected>} />
        <Route path="audit" element={<Protected admin><AuditLog /></Protected>} />
        <Route path="logins" element={<Protected admin><LoginApprovals /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
