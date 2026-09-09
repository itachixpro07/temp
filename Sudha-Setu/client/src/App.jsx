import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { Spinner } from './components/Ui';
import { useAuth } from './lib/useAuth';

import Home from './pages/Home';
import Diseases from './pages/Diseases';
import Medicines from './pages/Medicines';
import Hospitals from './pages/Hospitals';
import Account from './pages/Account';
import CaseDetail from './pages/CaseDetail';
import SignIn from './pages/SignIn';
import Register from './pages/Register';
import VerifyOtp from './pages/VerifyOtp';
import ResetPassword from './pages/ResetPassword';
import NotFound from './pages/NotFound';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Conditions and Remedies read the public /api/kb endpoint, so they
            work signed out. Everything else needs a session. */}
        <Route index element={<Home />} />
        <Route path="diseases" element={<Diseases />} />
        <Route path="medicines" element={<Medicines />} />
        <Route path="hospitals" element={<Hospitals />} />

        <Route
          path="account"
          element={
            <RequireAuth>
              <Account />
            </RequireAuth>
          }
        />
        <Route
          path="cases/:id"
          element={
            <RequireAuth>
              <CaseDetail />
            </RequireAuth>
          }
        />

        <Route path="signin" element={<SignIn />} />
        <Route path="register" element={<Register />} />
        <Route path="verify" element={<VerifyOtp />} />
        <Route path="reset" element={<ResetPassword />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
