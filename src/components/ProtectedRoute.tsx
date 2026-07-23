import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getHomeRouteByRole } from "@/lib/roleRoutes";
import { PageSkeleton } from "@/components/ui/loading-skeletons";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

const ProtectedRoute = ({ children, requiredRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, userRole, checkAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const verifyAuth = async () => {
      if (!isAuthenticated) {
        await checkAuth();
      }
      setIsLoading(false);
    };

    verifyAuth();
  }, [isAuthenticated, checkAuth]);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRoles && userRole && !requiredRoles.includes(userRole)) {
    return <Navigate to={getHomeRouteByRole(userRole)} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;