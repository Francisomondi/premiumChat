import { Navigate, Outlet } from "react-router-dom";
import useAuthStore from "../../store/useAuthStore";

function PublicRoute() {
  const user = useAuthStore((state) => state.user);

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
    const destination =
      user?.role === "FAN"
        ? user.ageVerified
          ? "/explore"
          : "/verify-age"
        : "/dashboard";

    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}

export default PublicRoute;