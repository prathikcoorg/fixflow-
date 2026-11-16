import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./ResidentDashboard.css";
import LogoutButton from "../../components/LogoutButton";
import RecentlyCompleted from "../../components/RecentlyCompleted";

import {
  Bell,
  Plus,
  Search,
  Wrench,
  Clock3,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  MapPin,
  ChevronRight,
  Zap,
  X,
} from "lucide-react";

const API_BASE_URL = "http://localhost:5000";
const API_URL = `${API_BASE_URL}/api/maintenance-requests`;
const AUTH_URL = `${API_BASE_URL}/api/auth`;
const NOTIFICATIONS_URL = `${API_BASE_URL}/api/notifications`;

const INITIAL_FORM = {
  title: "",
  description: "",
  category: "Plumbing",
  location: "",
  priority: "medium",
  is_public: false,
};

function getInitial(name) {
  return name?.trim()?.charAt(0)?.toUpperCase() || "U";
}

function getFirstName(name) {
  return name?.trim()?.split(/\s+/)[0] || "there";
}

function Logo() {
  return (
    <Link className="resident-brand" to="/" aria-label="FixFlow AI home">
      <span className="resident-brand-icon">
        <Zap size={18} fill="currentColor" />
      </span>
      <span>
        FixFlow <span></span>
      </span>
    </Link>
  );
}

function StatusBadge({ status }) {
  const tone =
    status === "resolved" || status === "closed"
      ? "green"
      : status === "in_progress"
        ? "blue"
        : status === "open"
          ? "amber"
          : "blue";

  const labels = {
    open: "Open",
    in_progress: "In progress",
    resolved: "Resolved",
    closed: "Closed",
  };

  return (
    <span className={`resident-status ${tone}`}>
      <span className="status-dot" />
      {labels[status] || status}
    </span>
  );
}

function getRequestTone(status) {
  if (status === "resolved" || status === "closed") return "green";
  if (status === "open") return "amber";
  return "blue";
}

function formatUpdated(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "";

  return `Updated ${date.toLocaleString()}`;
}

export default function ResidentDashboard() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Resident notification state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");

  const notificationIdsRef = useRef(new Set());
  const hasLoadedNotificationsRef = useRef(false);

  // Load the user authenticated through Google.
  useEffect(() => {
    const controller = new AbortController();

    async function loadCurrentUser() {
      try {
        setAuthLoading(true);
        setAuthError("");

        const response = await fetch(`${AUTH_URL}/me`, {
          credentials: "include",
          signal: controller.signal,
        });

        if (response.status === 401) {
          throw new Error(
            "You are not signed in. Please sign in with Google."
          );
        }

        if (!response.ok) {
          throw new Error("Unable to load your account.");
        }

        const result = await response.json();

        if (!result.success || !result.user) {
          throw new Error("The server returned an invalid user response.");
        }

        setUser(result.user);
      } catch (err) {
        if (err.name !== "AbortError") {
          setAuthError(err.message || "Unable to load your account.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setAuthLoading(false);
        }
      }
    }

    loadCurrentUser();

    return () => controller.abort();
  }, []);

  // Load resident maintenance requests.
  async function loadRequests(signal) {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_URL, {
        credentials: "include",
        signal,
      });

      if (!response.ok) {
        throw new Error("Failed to load maintenance requests.");
      }

      const result = await response.json();

      if (!result.success || !Array.isArray(result.data)) {
        throw new Error("The server returned an unexpected response.");
      }

      setRequests(result.data);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Could not connect to FixFlow AI.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    loadRequests(controller.signal);

    return () => controller.abort();
  }, []);

  // Fetch notifications and unread count.
  const fetchNotifications = useCallback(async (signal) => {
    try {
      setNotificationsLoading(true);
      setNotificationError("");

      const [listResponse, countResponse] = await Promise.all([
        fetch(NOTIFICATIONS_URL, {
          credentials: "include",
          signal,
        }),
        fetch(`${NOTIFICATIONS_URL}/unread-count`, {
          credentials: "include",
          signal,
        }),
      ]);

      if (!listResponse.ok || !countResponse.ok) {
        throw new Error("Unable to load notifications.");
      }

      const [listResult, countResult] = await Promise.all([
        listResponse.json(),
        countResponse.json(),
      ]);

      if (!listResult.success || !Array.isArray(listResult.notifications)) {
        throw new Error("Unexpected notifications response.");
      }

      const nextNotifications = listResult.notifications;
      const nextUnreadCount = Number(countResult.unreadCount || 0);

      // Detect notifications received after the initial load.
      if (hasLoadedNotificationsRef.current) {
        const newlyReceived = nextNotifications.filter(
          (item) =>
            !item.is_read && !notificationIdsRef.current.has(item.id)
        );

        if (newlyReceived.length > 0) {
          setSuccessMessage(
            newlyReceived.length === 1
              ? "You have a new notification."
              : `You have ${newlyReceived.length} new notifications.`
          );
        }
      }

      notificationIdsRef.current = new Set(
        nextNotifications.map((item) => item.id)
      );

      hasLoadedNotificationsRef.current = true;

      setNotifications(nextNotifications);
      setUnreadCount(nextUnreadCount);
    } catch (err) {
      if (err.name !== "AbortError") {
        setNotificationError(
          err.message || "Could not load notifications."
        );
      }
    } finally {
      if (!signal?.aborted) {
        setNotificationsLoading(false);
      }
    }
  }, []);

  // Poll notifications every 10 seconds while the resident is logged in.
  useEffect(() => {
    if (!user) return undefined;

    const controller = new AbortController();

    fetchNotifications(controller.signal);

    const intervalId = window.setInterval(() => {
      fetchNotifications();
    }, 10000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [user, fetchNotifications]);

  // Mark one notification as read.
  async function handleMarkNotificationRead(notificationId) {
    try {
      const response = await fetch(
        `${NOTIFICATIONS_URL}/${notificationId}/read`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Unable to mark notification as read.");
      }

      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId
            ? { ...item, is_read: true }
            : item
        )
      );

      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (err) {
      setNotificationError(
        err.message || "Unable to update notification."
      );
    }
  }

  // Mark all notifications as read.
  async function handleMarkAllNotificationsRead() {
    try {
      const response = await fetch(`${NOTIFICATIONS_URL}/read-all`, {
        method: "PATCH",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Unable to mark notifications as read.");
      }

      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true }))
      );

      setUnreadCount(0);
    } catch (err) {
      setNotificationError(
        err.message || "Unable to update notifications."
      );
    }
  }

  // Handle notification click.
  async function handleNotificationClick(notification) {
    if (!notification.is_read) {
      await handleMarkNotificationRead(notification.id);
    }

    setNotificationsOpen(false);

    if (notification.request_id) {
      window.location.href = "/work-status";
    }
  }

  function formatNotificationTime(dateString) {
    if (!dateString) return "Just now";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function handleFormChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function openRequestForm() {
    setSubmitError("");
    setSuccessMessage("");
    setFormOpen(true);
  }

  // Submit a new maintenance request.
  async function handleSubmit(event) {
    event.preventDefault();

    setSubmitError("");
    setSuccessMessage("");

    if (!user) {
      setSubmitError("Please sign in before submitting a request.");
      return;
    }

    // Transitional payload.
    // The backend should validate the session and derive these IDs itself.
    const payload = {
      ...form,
      organization_id: user.organization_id,
      reporter_id: user.id,
    };

    try {
      setSubmitting(true);

      const response = await fetch(API_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to create the maintenance request."
        );
      }

      setForm(INITIAL_FORM);
      setFormOpen(false);

      setSuccessMessage(
        "Your maintenance request was submitted successfully."
      );

      await loadRequests();
    } catch (err) {
      setSubmitError(
        err.message || "Could not connect to the FixFlow AI backend."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Logout.
  async function handleLogout() {
    try {
      const response = await fetch(`${AUTH_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Unable to sign out. Please try again.");
      }

      window.location.href = "/login";
    } catch (err) {
      setAuthError(err.message);
    }
  }

  const totalRequests = requests.length;

  const inProgressCount = requests.filter(
    (request) => request.status === "in_progress"
  ).length;

  const openCount = requests.filter(
    (request) => request.status === "open"
  ).length;

  const resolvedCount = requests.filter(
    (request) =>
      request.status === "resolved" || request.status === "closed"
  ).length;

  return (
    <div className="resident-app">
      <aside className="resident-sidebar">
        <Logo />

        <div className="resident-org">
          <div className="org-avatar">C</div>

          <div>
            <strong>Campus Community</strong>
            <span>Resident portal</span>
          </div>

          <ChevronRight size={15} />
        </div>

        <span className="resident-nav-label">WORKSPACE</span>

        <nav className="resident-nav">
          <Link to="/resident" className="selected">
            <Search size={18} /> Overview
          </Link>

          <a href="#my-requests">
            <Wrench size={18} /> My requests
          </a>

          <Link to="/work-status">
            <Clock3 size={18} /> Public work status
          </Link>
        </nav>

        <div className="resident-sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">
              <AlertCircle size={18} />
            </div>

            <strong>Need something fixed?</strong>
            <p>Report an issue and follow every update here.</p>

            <a href="#report-issue">
              Report an issue <ArrowUpRight size={14} />
            </a>
          </div>

          <div className="resident-profile">
            <div className="profile-avatar">
              {getInitial(user?.full_name)}
            </div>

            <div className="profile-details">
              <strong>
                {authLoading
                  ? "Loading profile..."
                  : user?.full_name || "Unknown user"}
              </strong>

              <span>
                {user?.email || "Account details unavailable"}
              </span>
            </div>

            <button
              type="button"
              className="profile-logout-button"
              onClick={handleLogout}
              disabled={authLoading || !user}
              title="Sign out"
              aria-label="Sign out"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="resident-main">
        <header className="resident-topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} /> Overview
          </div>

          <div className="topbar-actions">
            <span className="community-status">
              <span /> Community portal
            </span>

            <LogoutButton />

            {/* Notification bell and dropdown */}
            <div className="resident-notification-wrapper">
              <button
                type="button"
                className="notification-button"
                aria-label={`Notifications${
                  unreadCount ? `, ${unreadCount} unread` : ""
                }`}
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((current) => !current);

                  if (!notificationsOpen) {
                    fetchNotifications();
                  }
                }}
              >
                <Bell size={19} />

                {unreadCount > 0 && (
                  <span className="resident-notification-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="resident-notification-dropdown">
                  <div className="resident-notification-heading">
                    <div>
                      <strong>Notifications</strong>

                      <span>
                        {unreadCount > 0
                          ? `${unreadCount} unread`
                          : "You're all caught up"}
                      </span>
                    </div>

                    <button
                      type="button"
                      aria-label="Close notifications"
                      onClick={() => setNotificationsOpen(false)}
                    >
                      <X size={17} />
                    </button>
                  </div>

                  {unreadCount > 0 && (
                    <div className="resident-notification-actions">
                      <button
                        type="button"
                        onClick={handleMarkAllNotificationsRead}
                      >
                        Mark all as read
                      </button>
                    </div>
                  )}

                  <div className="resident-notification-list">
                    {notificationsLoading && notifications.length === 0 ? (
                      <div className="resident-notification-empty">
                        Loading notifications...
                      </div>
                    ) : notificationError ? (
                      <div
                        className="resident-notification-error"
                        role="alert"
                      >
                        {notificationError}

                        <button
                          type="button"
                          onClick={() => fetchNotifications()}
                        >
                          Try again
                        </button>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="resident-notification-empty">
                        <Bell size={23} />

                        <strong>No notifications yet</strong>

                        <span>
                          Updates about your requests will appear here.
                        </span>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          type="button"
                          key={notification.id}
                          className={`resident-notification-item ${
                            notification.is_read ? "" : "unread"
                          }`}
                          onClick={() =>
                            handleNotificationClick(notification)
                          }
                        >
                          <span className="resident-notification-icon">
                            <Bell size={16} />
                          </span>

                          <span className="resident-notification-content">
                            <strong>{notification.title}</strong>

                            <span>{notification.message}</span>

                            <small>
                              {formatNotificationTime(
                                notification.created_at
                              )}
                            </small>
                          </span>

                          {!notification.is_read && (
                            <span className="resident-notification-unread-dot" />
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  <div className="resident-notification-footer">
                    Request updates and maintenance activity
                  </div>
                </div>
              )}
            </div>

            <div className="profile-avatar small-avatar">
              {getInitial(user?.full_name)}
            </div>
          </div>
        </header>

        <div className="resident-content">
          {authError && (
            <div role="alert" className="request-form-error">
              {authError}{" "}
              <Link to="/login">Go to login</Link>
            </div>
          )}

          <section className="resident-welcome">
            <div>
              <span className="resident-eyebrow">
                YOUR COMMUNITY, IN GOOD HANDS
              </span>

              <h1>
                {authLoading
                  ? "Loading your workspace..."
                  : `Welcome, ${getFirstName(user?.full_name)}`}

                <span> ✳</span>
              </h1>

              <p>
                {user?.email || "What needs fixing today?"}
              </p>
            </div>

            <button
              type="button"
              className="resident-primary-button"
              onClick={openRequestForm}
              disabled={authLoading || !user}
            >
              <Plus size={18} /> Report an issue
            </button>
          </section>

          <section
            className="resident-stats"
            aria-label="Request summary"
          >
            <article className="resident-stat">
              <div className="stat-top">
                <span>My requests</span>

                <span className="stat-icon purple">
                  <Wrench size={17} />
                </span>
              </div>

              <strong>
                {loading ? "—" : String(totalRequests).padStart(2, "0")}
              </strong>

              <p>Total requests</p>
            </article>

            <article className="resident-stat">
              <div className="stat-top">
                <span>Being worked on</span>

                <span className="stat-icon blue">
                  <Clock3 size={17} />
                </span>
              </div>

              <strong>
                {loading
                  ? "—"
                  : String(inProgressCount).padStart(2, "0")}
              </strong>

              <p>In progress</p>
            </article>

            <article className="resident-stat">
              <div className="stat-top">
                <span>Awaiting assignment</span>

                <span className="stat-icon amber">
                  <AlertCircle size={17} />
                </span>
              </div>

              <strong>
                {loading ? "—" : String(openCount).padStart(2, "0")}
              </strong>

              <p>Open requests</p>
            </article>

            <article className="resident-stat">
              <div className="stat-top">
                <span>Resolved</span>

                <span className="stat-icon green">
                  <CheckCircle2 size={17} />
                </span>
              </div>

              <strong>
                {loading
                  ? "—"
                  : String(resolvedCount).padStart(2, "0")}
              </strong>

              <p>Completed requests</p>
            </article>
          </section>

          <section className="resident-work-banner">
            <div className="work-banner-icon">
              <Clock3 size={21} />
            </div>

            <div className="work-banner-copy">
              <strong>
                See what's happening around your community
              </strong>

              <p>
                Follow maintenance progress and view published work updates.
              </p>
            </div>

            <Link to="/work-status">
              View work status <ArrowUpRight size={16} />
            </Link>
          </section>

          <section
            className="resident-requests-section"
            id="my-requests"
          >
            <div className="resident-section-heading">
              <div>
                <h2>Your requests</h2>
                <p>Track progress from report to resolution.</p>
              </div>

              <Link
                to="/work-status"
                className="resident-view-all"
              >
                Public status board <ArrowUpRight size={15} />
              </Link>
            </div>

            {successMessage && (
              <p
                role="status"
                className="request-success-message"
              >
                <CheckCircle2 size={17} /> {successMessage}
              </p>
            )}

            {loading && (
              <p role="status">
                Loading maintenance requests...
              </p>
            )}

            {!loading && error && (
              <div role="alert">
                <p>{error}</p>

                <button
                  type="button"
                  className="resident-primary-button"
                  onClick={() => loadRequests()}
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && requests.length === 0 && (
              <div className="resident-request-card">
                <div className="request-main">
                  <h3>No requests yet</h3>

                  <p>
                    Submit your first maintenance request to get started.
                  </p>
                </div>
              </div>
            )}

            {!loading && !error && requests.length > 0 && (
              <div className="resident-request-list">
                {requests.map((request) => {
                  const tone = getRequestTone(request.status);

                  return (
                    <article
                      className="resident-request-card"
                      key={request.id}
                    >
                      <div className={`request-icon ${tone}`}>
                        {tone === "green" ? (
                          <CheckCircle2 size={20} />
                        ) : tone === "amber" ? (
                          <AlertCircle size={20} />
                        ) : (
                          <Wrench size={20} />
                        )}
                      </div>

                      <div className="request-main">
                        <div className="request-title-row">
                          <h3>{request.title}</h3>

                          <StatusBadge status={request.status} />
                        </div>

                        <div className="request-metadata">
                          <span>
                            FF-{String(request.id).padStart(4, "0")}
                          </span>

                          <span>
                            <MapPin size={13} /> {request.location}
                          </span>

                          <span>
                            {request.category || "Uncategorized"}
                          </span>

                          <span>
                            Priority: {request.priority || "medium"}
                          </span>
                        </div>

                        <p className="request-updated">
                          {formatUpdated(request.updated_at)}
                        </p>
                      </div>

                      <Link
                        className="request-open"
                        to="/work-status"
                        aria-label={`View status for ${request.title}`}
                      >
                        <ChevronRight size={19} />
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section
            className="resident-report-section"
            id="report-issue"
          >
            <div className="report-copy">
              <span className="report-sparkle">
                <Zap size={16} /> SMARTER REPORTING
              </span>

              <h2>Something not working?</h2>

              <p>
                Tell us what's wrong. FixFlow AI will help organize your report
                so the right team can review it.
              </p>

              <button
                type="button"
                className="resident-primary-button"
                onClick={openRequestForm}
                disabled={authLoading || !user}
              >
                <Plus size={18} /> Create a request
              </button>
            </div>

            <div className="report-decoration">
              <div className="decoration-ring ring-one" />
              <div className="decoration-ring ring-two" />

              <div className="decoration-center">
                <Wrench size={32} />
              </div>

              <div className="decoration-check">
                <CheckCircle2 size={19} />
              </div>
            </div>

            <RecentlyCompleted />
          </section>

          <footer className="resident-footer">
            <Logo />
            <span>Less chasing. More fixing.</span>
            <span>FixFlow · Live API data (development)</span>
          </footer>
        </div>
      </main>

      {/* Create maintenance request modal */}
      {formOpen && (
        <div
          className="request-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !submitting
            ) {
              setFormOpen(false);
            }
          }}
        >
          <section
            className="request-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-modal-title"
          >
            <div className="request-modal-header">
              <div>
                <span className="resident-eyebrow">
                  MAINTENANCE REQUEST
                </span>

                <h2 id="request-modal-title">
                  Report an issue
                </h2>

                <p>
                  Describe the problem so your community team can help.
                </p>
              </div>

              <button
                type="button"
                className="request-modal-close"
                aria-label="Close form"
                disabled={submitting}
                onClick={() => setFormOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="request-form"
              onSubmit={handleSubmit}
            >
              <label>
                Issue title

                <input
                  name="title"
                  value={form.title}
                  onChange={handleFormChange}
                  placeholder="e.g. Bathroom tap is leaking"
                  maxLength={200}
                  required
                />
              </label>

              <label>
                Description

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  placeholder="Describe what's happening..."
                  rows={4}
                  required
                />
              </label>

              <div className="request-form-row">
                <label>
                  Category

                  <select
                    name="category"
                    value={form.category}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="Plumbing">Plumbing</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Electrical & IT">
                      Electrical &amp; IT
                    </option>
                    <option value="Internet">Internet / Wi-Fi</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="Furniture">Furniture</option>
                    <option value="HVAC">
                      Air conditioning / HVAC
                    </option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <label>
                  Priority

                  <select
                    name="priority"
                    value={form.priority}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
              </div>

              <label>
                Location

                <input
                  name="location"
                  value={form.location}
                  onChange={handleFormChange}
                  placeholder="e.g. Block A, Room 101"
                  maxLength={200}
                  required
                />
              </label>

              <label className="request-public-toggle">
                <input
                  type="checkbox"
                  name="is_public"
                  checked={form.is_public}
                  onChange={handleFormChange}
                />

                <span>
                  <strong>
                    Publish on the public work-status board
                  </strong>

                  <small>
                    Let community members see this request's progress.
                  </small>
                </span>
              </label>

              {submitError && (
                <p
                  role="alert"
                  className="request-form-error"
                >
                  {submitError}
                </p>
              )}

              <div className="request-form-actions">
                <button
                  type="button"
                  className="request-secondary-button"
                  disabled={submitting}
                  onClick={() => setFormOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="resident-primary-button"
                  disabled={submitting || authLoading || !user}
                >
                  {submitting ? (
                    "Submitting..."
                  ) : (
                    <>
                      <Plus size={18} /> Submit request
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}