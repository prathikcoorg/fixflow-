
import "./WorkStatusBoard.css";
import { useState, useEffect, useCallback } from "react";
import {
  Zap,
  Search,
  ArrowLeft,
  ArrowUpRight,
  MapPin,
  Clock3,
  CheckCircle2,
  CircleDot,
  Wrench,
  CalendarDays,
  ShieldCheck,
  X,
  Radio,
} from "lucide-react";

const API_URL = "";

// Set VITE_PUBLIC_ORGANIZATION_ID=1 in your frontend environment.
const ORGANIZATION_ID =
  import.meta.env.VITE_PUBLIC_ORGANIZATION_ID || "1";

function formatDate(value) {
  if (!value) return "Pending";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatUpdated(value) {
  if (!value) return "Update time unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Update time unavailable";
  }

  return `Updated ${date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function normalizeStatus(status) {
  return String(status || "open")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");
}

function formatStatus(status) {
  const normalized = normalizeStatus(status);

  const labels = {
    open: "Open",
    in_progress: "In progress",
    resolved: "Resolved",
    closed: "Closed",
  };

  return labels[normalized] || "Open";
}

function formatPriority(priority) {
  const value = String(priority || "medium");

  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function mapRequest(request) {
  const status = normalizeStatus(request.status);

  const isAssigned = Boolean(
    request.assigned_technician_id || request.technician_name
  );

  const isInProgress = [
    "in_progress",
    "resolved",
    "closed",
  ].includes(status);

  const isResolved = ["resolved", "closed"].includes(status);

  const receivedAt = request.created_at;
  const assignedAt = request.assigned_at;
  const startedAt = request.work_started_at;
  const resolvedAt = request.completed_at;

  const updates = [
    {
      status: "Request received",
      date: receivedAt
        ? formatDate(receivedAt)
        : "Date unavailable",
      done: true,
    },
    {
      status: "Technician assigned",
      date: isAssigned
        ? formatDate(assignedAt)
        : "Awaiting assignment",
      detail: isAssigned
        ? `Assigned to: ${request.technician_name || "Technician"}`
        : null,
      done: isAssigned,
    },
    {
      status: "Work in progress",
      date: isInProgress
        ? formatDate(startedAt || request.updated_at)
        : "Pending",
      done: isInProgress,
    },
    {
      status: "Resolved",
      date: isResolved
        ? formatDate(resolvedAt || request.updated_at)
        : "Pending",
      done: isResolved,
    },
  ];

  return {
    id: `FF-${String(request.id).padStart(4, "0")}`,
    databaseId: request.id,
    title: request.title || "Untitled request",
    category: request.category || "General",
    location: request.location || "Location unavailable",
    priority: formatPriority(request.priority),
    status: formatStatus(status),
    date: formatDate(receivedAt),
    updated: formatUpdated(request.updated_at),
    description: request.description || "No description provided.",
    technicianName: request.technician_name || null,
    updates,
  };
}

function WorkStatusBoard() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All work");
  const [selected, setSelected] = useState(null);
  const [workItems, setWorkItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filters = ["All work", "Open", "In progress", "Resolved"];

  const fetchWorkItems = useCallback(async (showLoader = false) => {
    if (!ORGANIZATION_ID) {
      setError(
        "Public board organization is not configured. Set VITE_PUBLIC_ORGANIZATION_ID=1 in your frontend environment and redeploy."
      );
      setLoading(false);
      return;
    }

    if (showLoader) {
      setLoading(true);
    }

    try {
      const response = await fetch(
        `${API_URL}/api/maintenance-requests/public?organization_id=${encodeURIComponent(
          ORGANIZATION_ID
        )}`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || `Unable to load updates. HTTP ${response.status}`
        );
      }

      const items = Array.isArray(result.data)
        ? result.data.map(mapRequest)
        : [];

      setWorkItems(items);

      setSelected((current) => {
        if (!current) return null;

        return (
          items.find(
            (item) =>
              String(item.databaseId) === String(current.databaseId)
          ) || null
        );
      });

      setError("");
    } catch (err) {
      console.error("Public work board fetch failed:", err);

      setError(
        err.message || "Something went wrong while loading work updates."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkItems(true);

    const interval = setInterval(() => {
      fetchWorkItems(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchWorkItems]);

  const visibleItems = workItems.filter((item) => {
    const matchesFilter =
      filter === "All work" || item.status === filter;

    const query = search.trim().toLowerCase();

    const matchesSearch =
      item.title.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query) ||
      item.location.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      (item.technicianName || "").toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  const resolvedCount = workItems.filter(
    (item) => item.status === "Resolved" || item.status === "Closed"
  ).length;

  const activeCount = workItems.filter(
    (item) => item.status === "In progress"
  ).length;

  const openCount = workItems.filter(
    (item) => item.status === "Open"
  ).length;

  function statusClass(status) {
    return status.toLowerCase().replace(" ", "-");
  }

  return (
    <div className="public-board">
      <header className="public-header">
        <a href="/" className="public-brand">
          <span className="public-brand-icon">
            <Zap size={21} fill="currentColor" />
          </span>

          <span>
            fixflow<span className="public-brand-ai">.ai</span>
          </span>
        </a>

        <div className="public-header-right">
          <span className="public-board-label">
            <Radio size={14} /> COMMUNITY UPDATES
          </span>

          <a className="public-login-link" href="/login">
            Staff sign in <ArrowUpRight size={15} />
          </a>
        </div>
      </header>

      <main className="public-main">
        <a href="/" className="public-back-link">
          <ArrowLeft size={15} /> Back to home
        </a>

        <section className="public-hero">
          <div className="public-eyebrow">
            <span /> TRANSPARENT. TRACKABLE. COMMUNITY-DRIVEN.
          </div>

          <h1>
            Work status, <span>without the guesswork.</span>
          </h1>

          <p>
            Follow published maintenance updates and see what’s being fixed
            across your community.
          </p>

          <div className="public-hero-meta">
            <span>
              <ShieldCheck size={15} /> Public information
            </span>

            <span>
              <Clock3 size={15} /> Updates from the maintenance team
            </span>
          </div>
        </section>

        <section className="public-summary">
          <article className="public-summary-card">
            <span className="public-summary-icon blue">
              <CircleDot size={19} />
            </span>

            <div>
              <span>Open requests</span>
              <strong>{openCount}</strong>
            </div>
          </article>

          <article className="public-summary-card">
            <span className="public-summary-icon purple">
              <Wrench size={19} />
            </span>

            <div>
              <span>Being worked on</span>
              <strong>{activeCount}</strong>
            </div>
          </article>

          <article className="public-summary-card">
            <span className="public-summary-icon green">
              <CheckCircle2 size={19} />
            </span>

            <div>
              <span>Resolved</span>
              <strong>{resolvedCount}</strong>
            </div>
          </article>
        </section>

        <section className="public-work-section">
          <div className="public-section-heading">
            <div>
              <div className="public-section-kicker">
                MAINTENANCE TRANSPARENCY
              </div>

              <h2>Community work board</h2>

              <p>
                Browse published requests and follow their latest reported
                status.
              </p>
            </div>

            <span className="public-results-count">
              {visibleItems.length} updates
            </span>
          </div>

          <div className="public-toolbar">
            <label className="public-search">
              <Search size={18} />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by issue, location or ID..."
              />

              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </label>

            <div className="public-filter-list">
              {filters.map((item) => (
                <button
                  key={item}
                  className={filter === item ? "selected" : ""}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="public-empty">
              <strong>Unable to load work updates</strong>

              <p>{error}</p>

              <button onClick={() => fetchWorkItems(true)}>
                Try again
              </button>
            </div>
          )}

          {loading && (
            <div className="public-empty">
              <strong>Loading community updates...</strong>

              <p>Please wait while we fetch the latest requests.</p>
            </div>
          )}

          {!loading && !error && (
            <div className="public-work-list">
              {visibleItems.map((item) => (
                <article
                  className="public-work-card"
                  key={item.databaseId}
                >
                  <div className="public-card-main">
                    <div
                      className={`public-category-icon ${item.category.toLowerCase()}`}
                    >
                      {item.category === "Electrical" ? (
                        <Zap size={20} />
                      ) : item.category === "Plumbing" ? (
                        <Wrench size={20} />
                      ) : item.category === "Furniture" ? (
                        <CircleDot size={20} />
                      ) : (
                        <Wrench size={20} />
                      )}
                    </div>

                    <div className="public-work-info">
                      <div className="public-work-id">
                        {item.id} <span>·</span> {item.category}
                      </div>

                      <h3>{item.title}</h3>

                      <div className="public-work-location">
                        <MapPin size={13} /> {item.location}
                      </div>

                      <p>{item.description}</p>
                    </div>
                  </div>

                  <div className="public-card-side">
                    <span
                      className={`public-status-badge ${statusClass(
                        item.status
                      )}`}
                    >
                      <i />
                      {item.status}
                    </span>

                    <span
                      className={`public-priority-badge ${item.priority.toLowerCase()}`}
                    >
                      {item.priority} priority
                    </span>

                    <span className="public-updated">
                      <Clock3 size={13} /> {item.updated}
                    </span>

                    <button
                      className="public-details-button"
                      onClick={() => setSelected(item)}
                    >
                      Track progress <ArrowUpRight size={15} />
                    </button>
                  </div>
                </article>
              ))}

              {visibleItems.length === 0 && (
                <div className="public-empty">
                  <Search size={26} />

                  <strong>No matching work updates</strong>

                  <p>
                    Try a different keyword or select another status filter.
                  </p>

                  <button
                    onClick={() => {
                      setSearch("");
                      setFilter("All work");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="public-disclaimer">
            <ShieldCheck size={17} />

            <p>
              <strong>Public status board</strong> — Only requests approved
              for public viewing appear here.
            </p>
          </div>
        </section>

        <footer className="public-footer">
          <a href="/" className="public-footer-brand">
            <Zap size={16} fill="currentColor" /> FixFlow
          </a>

          <span>
            Better visibility. Better maintenance. Better communities.
          </span>

          <span>© 2026 FixFlow</span>
        </footer>
      </main>

      {selected && (
        <div
          className="public-modal-backdrop"
          onClick={() => setSelected(null)}
        >
          <section
            className="public-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="public-modal-heading">
              <div>
                <span className="public-modal-id">
                  {selected.id} · {selected.category}
                </span>

                <h2>{selected.title}</h2>
              </div>

              <button
                onClick={() => setSelected(null)}
                aria-label="Close details"
              >
                <X size={20} />
              </button>
            </div>

            <p className="public-modal-location">
              <MapPin size={15} /> {selected.location}
            </p>

            <div className="public-modal-badges">
              <span
                className={`public-status-badge ${statusClass(
                  selected.status
                )}`}
              >
                <i />
                {selected.status}
              </span>

              <span
                className={`public-priority-badge ${selected.priority.toLowerCase()}`}
              >
                {selected.priority} priority
              </span>
            </div>

            <p className="public-modal-description">
              {selected.description}
            </p>

            <h3 className="public-timeline-title">
              Reported progress
            </h3>

            <div className="public-timeline">
              {selected.updates.map((update, index) => (
                <div
                  className={`public-timeline-item ${
                    update.done ? "done" : ""
                  }`}
                  key={update.status}
                >
                  <div className="public-timeline-marker">
                    {update.done ? (
                      <CheckCircle2 size={17} />
                    ) : (
                      <span />
                    )}
                  </div>

                  <div className="public-timeline-copy">
                    <strong>{update.status}</strong>

                    <span>{update.date}</span>

                    {update.detail && (
                      <span className="public-technician-detail">
                        {update.detail}
                      </span>
                    )}
                  </div>

                  {index < selected.updates.length - 1 && (
                    <div
                      className={`public-timeline-line ${
                        update.done ? "done" : ""
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="public-modal-updated">
              <CalendarDays size={15} /> {selected.updated}
            </div>

            <button
              className="public-modal-close"
              onClick={() => setSelected(null)}
            >
              Close details
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

export default WorkStatusBoard;
