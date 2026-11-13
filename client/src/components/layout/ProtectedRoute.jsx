import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import useAuthStore from "../../store/useAuthStore";

function ProtectedRoute() {
  const user = useAuthStore((state) => state.user);

  const isAuthenticated = useAuthStore(
    (state) => state.isAuthenticated,
  );

  const isInitialized = useAuthStore(
    (state) => state.isInitialized,
  );

  const location = useLocation();

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#100d13] text-gray-300">
        Checking your session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  const role = user?.role;
  const path = location.pathname;

  // Both fans and creators must verify their age.
  if (
    ["FAN", "CREATOR"].includes(role) &&
    !user?.ageVerified &&
    path !== "/verify-age"
  ) {
    return <Navigate to="/verify-age" replace />;
  }

  // A verified fan belongs in creator discovery.
  if (role === "FAN") {
    if (
      user.ageVerified &&
      ["/verify-age", "/dashboard", "/creator"].includes(path)
    ) {
      return <Navigate to="/explore" replace />;
    }
  }

  // Creators use the creator portal, not fan discovery.
  if (role === "CREATOR") {
    if (
      user.ageVerified &&
      ["/verify-age", "/dashboard", "/explore"].includes(path)
    ) {
      return <Navigate to="/creator" replace />;
    }
  }

  // Admin accounts use the admin/dashboard area.
  if (
    role === "ADMIN" &&
    ["/verify-age", "/explore", "/creator"].includes(path)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;