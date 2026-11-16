import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

const API_URL = "http://localhost:5000";

export default function ProtectedRoute({ allowedRole, children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          if (!cancelled) setUser(null);
          return;
        }

        const data = await response.json();

        if (!cancelled) {
          setUser(data.user ?? null);
        }
      } catch (err) {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (loading) {
    return <div className="auth-loading">Checking login...</div>;
  }

  if (error) {
    return (
      <div className="auth-loading">
        Cannot connect to the server. Make sure the backend is running.
      </div>
    );
  }

  if (!user) {
    const loginPath =
      allowedRole === "manager"
        ? "/manager/login"
        : allowedRole === "technician"
        ? "/technician/login"
        : "/login";

    return <Navigate to={loginPath} replace state={{ from: location }} />;
  }

  if (user.role !== allowedRole) {
    if (user.role === "manager") {
      return <Navigate to="/manager" replace />;
    }

    if (user.role === "technician") {
      return <Navigate to="/technician" replace />;
    }

    return <Navigate to="/resident" replace />;
  }

  return children;
}