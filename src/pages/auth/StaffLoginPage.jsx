
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Wrench, Eye, EyeOff } from "lucide-react";

const API_BASE_URL = "";

const STAFF_CONFIG = {
  technician: {
    title: "Technician Login",
    subtitle: "Sign in to manage your assigned maintenance work.",
    dashboard: "/technician",
    icon: Wrench,
  },
  manager: {
    title: "Manager Login",
    subtitle: "Sign in to manage your community operations.",
    dashboard: "/manager",
    icon: ShieldCheck,
  },
};

export default function StaffLoginPage() {
  const { role } = useParams();
  const navigate = useNavigate();

  const config = STAFF_CONFIG[role];
  const Icon = config?.icon;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!config) {
    return (
      <main className="staff-login-page">
        <h1>Login page not found</h1>
        <Link to="/">Return home</Link>
      </main>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to sign in.");
      }

      // Navigate only to the dashboard associated with this login type.
      if (data.user?.role !== role) {
        throw new Error("Your account does not have the required role.");
      }

      navigate(config.dashboard, { replace: true });
    } catch (err) {
      setError(
        err.message || "Unable to connect to FixFlow AI. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="staff-login-page">
      <div className="staff-login-shell">
        <Link to="/" className="staff-back-link">
          <ArrowLeft size={17} />
          Back to home
        </Link>

        <section className="staff-login-card">
          <div className="staff-brand">
            <div className="staff-brand-icon">
              <Icon size={25} />
            </div>
            <span>FixFlow </span>
          </div>

          <div className="staff-login-heading">
            <p className="staff-eyebrow">STAFF PORTAL</p>
            <h1>{config.title}</h1>
            <p>{config.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="staff-login-form">
            <label htmlFor="staff-email">Work email</label>
            <input
              id="staff-email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label htmlFor="staff-password">Password</label>
            <div className="staff-password-field">
              <input
                id="staff-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="staff-password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <div className="staff-login-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="staff-login-submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="staff-login-footer">
            Staff accounts are provided by your community administrator.
          </p>
        </section>

        <p className="staff-resident-link">
          Are you a resident? <Link to="/login">Sign in with Google</Link>
        </p>
      </div>
    </main>
  );
}
