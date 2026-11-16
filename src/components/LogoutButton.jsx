
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

const API_BASE_URL = "";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleLogout() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/logout`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Logout failed.");
      }

      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to log out. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="logout-wrapper">
      <button
        type="button"
        className="logout-button"
        onClick={handleLogout}
        disabled={loading}
      >
        <LogOut size={17} />
        <span>{loading ? "Logging out..." : "Logout"}</span>
      </button>

      {error && (
        <p className="logout-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
