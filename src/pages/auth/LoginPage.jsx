
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Zap,
  ShieldCheck,
  Wrench,
  Users,
} from "lucide-react";
import "./LoginPage.css";

const API_BASE_URL = "";

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");

  function handleGoogleLogin() {
    window.location.href = `${API_URL}/api/auth/google`;
  }

  const errorMessages = {
    google_auth_failed: "Google sign-in failed. Please try again.",
    invalid_role: "Your account does not have a valid role.",
    resident_login_only: "Please use the login page for your account type.",
    logout_failed: "Sign-out failed. Please try again.",
  };

  return (
    <main className="login-page">
      <nav className="login-nav">
        <Link to="/" className="login-brand">
          <span className="login-brand-icon">
            <Zap size={21} fill="currentColor" />
          </span>
          <span>
            FixFlow<span className="login-brand-ai"></span>
          </span>
        </Link>

        <Link to="/" className="login-home-link">
          Back to home
        </Link>
      </nav>

      <section className="login-layout">
        <div className="login-intro">
          <span className="login-eyebrow">
            <span className="login-status-dot" />
            SMARTER MAINTENANCE MANAGEMENT
          </span>

          <h1>
            Everything fixed.
            <br />
            <span>Nothing overlooked.</span>
          </h1>

          <p className="login-description">
            One place to report issues, manage repairs, and keep
            your community running smoothly.
          </p>

          <div className="login-feature">
            <span className="login-feature-icon">
              <ShieldCheck size={22} />
            </span>
            <div>
              <strong>Your workspace, secured</strong>
              <p>
                Separate workspaces for residents, technicians,
                and managers.
              </p>
            </div>
          </div>
        </div>

        <div className="login-card">
          <div className="login-card-heading">
            <h2>Welcome to FixFlow</h2>
            <p>Choose how you want to sign in.</p>
          </div>

          {error && (
            <p role="alert" className="login-error">
              {errorMessages[error] || "Something went wrong. Please try again."}
            </p>
          )}

          <div className="role-login-options">
            <div className="role-login-option">
              <span className="role-login-icon">
                <Users size={21} />
              </span>

              <div className="role-login-info">
                <strong>Resident</strong>
                <p>Report issues and track maintenance.</p>
              </div>

              <button
                type="button"
                className="role-login-button"
                onClick={handleGoogleLogin}
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>

            <div className="role-login-option">
              <span className="role-login-icon">
                <Wrench size={21} />
              </span>

              <div className="role-login-info">
                <strong>Technician</strong>
                <p>Manage your assigned maintenance work.</p>
              </div>

              <Link
                to="/technician/login"
                className="role-login-button"
              >
                Sign in <ArrowRight size={16} />
              </Link>
            </div>

            <div className="role-login-option">
              <span className="role-login-icon">
                <ShieldCheck size={21} />
              </span>

              <div className="role-login-info">
                <strong>Manager</strong>
                <p>Oversee requests and community operations.</p>
              </div>

              <Link
                to="/manager/login"
                className="role-login-button"
              >
                Sign in <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <p className="role-login-note">
            Technician and manager accounts are provided by
            your community administrator.
          </p>
        </div>
      </section>

      <footer className="login-footer">
        <span>© {new Date().getFullYear()} FixFlow</span>
        <span>Built for communities that work better.</span>
      </footer>
    </main>
  );
}
