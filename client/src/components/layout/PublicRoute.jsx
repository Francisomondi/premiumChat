
import { Navigate, Outlet } from "react-router-dom";
import useAuthStore from "../../store/useAuthStore";

function PublicRoute() {
  const isAuthenticated = useAuthStore(
    (state) => state.isAuthenticated,
  );

  const isInitialized = useAuthStore(
    (state) => state.isInitialized,
  );

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#100d13] text-gray-300">
        Loading Premium Chat...
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default PublicRoute;
