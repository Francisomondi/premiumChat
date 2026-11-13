
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

import CreatorStudioLayout from "./features/creator/components/CreatorStudioLayout";
import CreatorPortalPage from "./features/creator/pages/CreatorPortalPage";
import CreatorProfilePage from "./features/creator/pages/CreatorProfilePage";
import EditCreatorProfilePage from "./features/creator/pages/EditCreatorProfilePage";
import CreatorContentPage from "./features/creator/pages/CreatorContentPage";
import PublicCreatorProfilePage from "./features/creator/pages/PublicCreatorProfilePage";

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
          path="/creators/:username"
          element={<PublicCreatorProfilePage />}
        />

        <Route path="/creator" element={<CreatorStudioLayout />}>
          <Route index element={<CreatorPortalPage />} />
          <Route path="profile" element={<CreatorProfilePage />} />
          <Route path="profile/edit" element={<EditCreatorProfilePage />} />
          <Route path="content" element={<CreatorContentPage />} />
        </Route>

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
