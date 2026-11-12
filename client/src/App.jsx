import { useEffect } from "react";
import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import useAuthStore from "./store/useAuthStore";

import ProtectedRoute from "./components/layout/ProtectedRoute";
import PublicRoute from "./components/layout/PublicRoute";

import LoginPage from "./features/auth/pages/LoginPage";
import RegisterPage from "./features/auth/pages/RegisterPage";
import AgeVerificationPage from "./features/auth/pages/AgeVerificationPage";

import DashboardPage from "./features/dashboard/DashboardPage";
import ExploreCreatorsPage from "./features/explore/pages/ExploreCreatorsPage";

function App() {
  const initializeAuth = useAuthStore(
    (state) => state.initializeAuth,
  );

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route
          path="/verify-age"
          element={<AgeVerificationPage />}
        />

        <Route
          path="/explore"
          element={<ExploreCreatorsPage />}
        />

        <Route
          path="/dashboard"
          element={<DashboardPage />}
        />
      </Route>

      <Route
        path="/"
        element={<Navigate to="/dashboard" replace />}
      />

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}

export default App;