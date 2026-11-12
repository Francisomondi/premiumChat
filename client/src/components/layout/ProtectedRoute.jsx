import { Navigate, Outlet, useLocation } from "react-router-dom";
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

  if (user?.role === "FAN") {
    if (!user.ageVerified && location.pathname !== "/verify-age") {
      return <Navigate to="/verify-age" replace />;
    }

    if (
      user.ageVerified &&
      ["/verify-age", "/dashboard"].includes(location.pathname)
    ) {
      return <Navigate to="/explore" replace />;
    }
  }

  if (
  user?.role !== "FAN" &&
  location.pathname === "/explore"
) {
  return <Navigate to="/dashboard" replace />;
}

  return <Outlet />;
}

export default ProtectedRoute;