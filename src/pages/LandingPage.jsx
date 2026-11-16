
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Wrench,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import "../App.css";

const workOrders = [
  { id: "FF-1024", title: "Wi-Fi not working", location: "Computer Lab 2", status: "In progress", tone: "blue", time: "Updated 12 min ago" },
  { id: "FF-1023", title: "Water leakage", location: "Block B · Floor 1", status: "Assigned", tone: "amber", time: "Updated 35 min ago" },
  { id: "FF-1022", title: "Corridor lights", location: "Block C · Floor 3", status: "Resolved", tone: "green", time: "Completed today" },
];

const features = [
  { icon: Sparkles, title: "AI-assisted reporting", description: "Turn issue descriptions into clear, categorized maintenance requests." },
  { icon: Clock3, title: "Progress everyone can see", description: "Keep residents informed with transparent status updates from report to resolution." },
  { icon: ShieldCheck, title: "Accountability by design", description: "Track assignments, progress, and resolution history in one place." },
];

function Logo() {
  return (
    <Link className="brand" to="/" aria-label="FixFlow AI home">
      <span className="brand-mark">
        <Zap size={19} strokeWidth={2.8} fill="currentColor" />
      </span>
      <span>
        FixFlow<span className="brand-ai"></span>
      </span>
    </Link>
  );
}

function DashboardPreview() {
  return (
    <div className="dashboard-window">
      <div className="window-topbar">
        <div className="window-dots"><span /><span /><span /></div>
        <div className="window-address">app.fixflow.ai / overview</div>
        <div className="window-avatar">F</div>
      </div>

      <div className="dashboard-body">
        <aside className="preview-sidebar">
          <Logo />
          <div className="preview-nav active"><LayoutDashboard size={16} /> Overview</div>
          <div className="preview-nav"><Wrench size={16} /> Work orders</div>
          <div className="preview-nav"><Clock3 size={16} /> Work status</div>
          <div className="sidebar-note">
            <span className="online-dot" /> All systems operational
          </div>
        </aside>

        <div className="preview-content">
          <div className="preview-heading">
            <div>
              <p className="eyebrow">COMMUNITY OVERVIEW</p>
              <h3>Maintenance at a glance.</h3>
              <p className="muted">A clearer view of your community's work.</p>
            </div>
            <span className="date-pill">Overview ↗</span>
          </div>

          <div className="metric-grid">
            <div className="metric-card">
              <span className="metric-icon blue-icon"><LayoutDashboard size={16} /></span>
              <span className="metric-label">Open requests</span>
              <strong>24</strong>
              <small>Across your community</small>
            </div>
            <div className="metric-card">
              <span className="metric-icon amber-icon"><Clock3 size={16} /></span>
              <span className="metric-label">In progress</span>
              <strong>08</strong>
              <small>Being worked on</small>
            </div>
            <div className="metric-card">
              <span className="metric-icon green-icon"><CheckCircle2 size={16} /></span>
              <span className="metric-label">Resolved today</span>
              <strong>06</strong>
              <small>Issues completed</small>
            </div>
          </div>

          <div className="orders-panel">
            <div className="orders-header">
              <div>
                <h4>Recent work orders</h4>
                <p className="muted">Transparent updates, all in one place.</p>
              </div>
              <Link className="view-link" to="/work-status">
                View status <ArrowUpRight size={14} />
              </Link>
            </div>

            <div className="orders-list">
              {workOrders.map((order) => (
                <div className="order-row" key={order.id}>
                  <span className={`order-symbol ${order.tone}`}>
                    <Wrench size={15} />
                  </span>
                  <div className="order-info">
                    <strong>{order.title}</strong>
                    <span>{order.location} · {order.id}</span>
                  </div>
                  <div className="order-meta">
                    <span className={`status-pill ${order.tone}`}>{order.status}</span>
                    <small>{order.time}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="preview-footer">
            <span><span className="online-dot" /> Work status overview</span>
            <span>Illustrative preview</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginOptions() {
  return (
    <div className="landing-login-options">
      <Link to="/login" className="landing-role-link">
        <span className="landing-role-icon"><Users size={19} /></span>
        <span className="landing-role-text">
          <strong>Resident</strong>
          <small>Continue with Google</small>
        </span>
        <ArrowRight size={16} />
      </Link>

      <Link to="/technician/login" className="landing-role-link">
        <span className="landing-role-icon"><Wrench size={19} /></span>
        <span className="landing-role-text">
          <strong>Technician</strong>
          <small>Staff sign in</small>
        </span>
        <ArrowRight size={16} />
      </Link>

      <Link to="/manager/login" className="landing-role-link">
        <span className="landing-role-icon"><ShieldCheck size={19} /></span>
        <span className="landing-role-text">
          <strong>Manager</strong>
          <small>Management sign in</small>
        </span>
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="site-shell" id="home">
      <header className="site-header">
        <nav className="navbar container" aria-label="Main navigation">
          <Logo />

          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <Link to="/work-status">Work status</Link>
          </div>

          <div className="nav-actions">
            <Link className="login-link" to="/login">Sign in</Link>
            <Link className="button button-primary button-small" to="/login">
              Get started <ArrowRight size={15} />
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="hero container">
          <div className="hero-copy">
            <div className="announcement">
              <span className="announcement-dot" />
              MAINTENANCE, MADE TRANSPARENT
              <ArrowUpRight size={13} />
            </div>

            <h1>
              Better spaces.
              <br />
              <span>Fewer loose ends.</span>
            </h1>

            <p className="hero-description">
              Report problems, follow every update, and keep your
              community running smoothly. One simple place for
              maintenance that actually gets done.
            </p>

            <div className="hero-actions">
              <Link className="button button-primary" to="/login">
                Sign in to FixFlow <ArrowRight size={17} />
              </Link>
              <a className="button button-secondary" href="#how-it-works">
                See how it works
              </a>
            </div>

            <div className="hero-proof">
              <span className="proof-icon"><CheckCircle2 size={16} /></span>
              <p>Report it. Track it. Know when it's done.</p>
            </div>

            <div className="landing-login-heading">
              <span>CHOOSE YOUR WORKSPACE</span>
              <p>Sign in based on your role.</p>
            </div>

            <LoginOptions />
          </div>

          <div className="hero-visual">
            <div className="visual-glow" />
            <div className="floating-chip chip-top">
              <span className="chip-icon"><Sparkles size={16} /></span>
              <span>
                <strong>AI-assisted</strong>
                <small>Issue categorization</small>
              </span>
            </div>

            <DashboardPreview />

            <div className="floating-chip chip-bottom">
              <span className="chip-icon chip-green"><CheckCircle2 size={16} /></span>
              <span>
                <strong>Everyone stays informed</strong>
                <small>Updates in one place</small>
              </span>
            </div>
          </div>
        </section>

        <section className="trust-strip container">
          <p>BUILT FOR COMMUNITIES THAT KEEP THINGS MOVING</p>
          <div className="trust-items">
            <span><ShieldCheck size={17} /> Transparent by design</span>
            <span><Zap size={17} /> AI-assisted workflows</span>
            <span><Clock3 size={17} /> Clear progress updates</span>
          </div>
        </section>

        <section className="features-section" id="features">
          <div className="container">
            <div className="section-heading">
              <span className="section-kicker">A BETTER WAY TO GET THINGS FIXED</span>
              <h2>
                From “someone should fix this”
                <br />
                to “it's already taken care of.”
              </h2>
              <p>
                Everything your community needs to report, manage,
                and track maintenance work.
              </p>
            </div>

            <div className="feature-grid">
              {features.map(({ icon: Icon, title, description }, index) => (
                <article className="feature-card" key={title}>
                  <div className={`feature-icon feature-icon-${index}`}>
                    <Icon size={21} />
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <a href="#how-it-works">
                    Explore feature <ArrowRight size={14} />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="workflow-section container" id="how-it-works">
          <div className="workflow-copy">
            <span className="section-kicker">SIMPLE FROM DAY ONE</span>
            <h2>
              One report.
              <br />
              A clear path to resolution.
            </h2>
            <p>
              No lost messages. No guessing who's responsible.
              Every request has an owner, a status, and a visible history.
            </p>
          </div>

          <div className="workflow-steps">
            <div className="workflow-step">
              <span className="step-number">01</span>
              <div>
                <h3>Report the issue</h3>
                <p>Add a description, location, and optional photo.</p>
              </div>
            </div>
            <div className="workflow-step">
              <span className="step-number">02</span>
              <div>
                <h3>Get the right person on it</h3>
                <p>Managers assign work and technicians see what's next.</p>
              </div>
            </div>
            <div className="workflow-step">
              <span className="step-number">03</span>
              <div>
                <h3>Follow the progress</h3>
                <p>Everyone can see approved updates until the work is complete.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="status-cta" id="work-status">
          <div className="container status-cta-inner">
            <div>
              <span className="section-kicker">NO MORE GUESSWORK</span>
              <h2>
                See the work.
                <br />
                Know the status.
              </h2>
              <p>
                A shared view of maintenance progress helps everyone
                stay in the loop.
              </p>
            </div>

            <Link className="button button-light" to="/work-status">
              View work status <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="site-footer container">
        <Logo />
        <p>Less chasing. More fixing.</p>
        <span>© {new Date().getFullYear()} FixFlow</span>
      </footer>
    </div>
  );
}
