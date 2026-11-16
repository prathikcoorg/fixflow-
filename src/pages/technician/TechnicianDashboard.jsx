
import LogoutButton from "../../components/LogoutButton";
import "./TechnicianDashboard.css";
import { useCallback, useEffect, useRef, useState } from "react";
import RecentlyCompleted from "../../components/RecentlyCompleted";

import {
  Zap,
  LayoutDashboard,
  ClipboardList,
  Clock3,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Search,
  Bell,
  ChevronRight,
  Wrench,
  Play,
  ArrowUpRight,
  LogOut,
  X,
} from "lucide-react";

const API_BASE_URL = "";
const API_URL = `${API_BASE_URL}/api/maintenance-requests`;
const AUTH_ME_URL = `${API_BASE_URL}/api/auth/me`;
const LOGOUT_URL = `${API_BASE_URL}/api/auth/logout`;
const NOTIFICATIONS_URL = `${API_BASE_URL}/api/notifications`;

const statusClass = {
  Assigned: "assigned",
  "In progress": "progress",
  Resolved: "resolved",
};

const databaseStatus = {
  Assigned: "open",
  "In progress": "in_progress",
  Resolved: "resolved",
};

function formatJob(item) {
  const statusMap = {
    open: "Assigned",
    assigned: "Assigned",
    in_progress: "In progress",
    resolved: "Resolved",
    closed: "Resolved",
  };

  return {
    id: `FF-${String(item.id).padStart(4, "0")}`,
    databaseId: item.id,
    title: item.title || "Untitled request",
    location: item.location || "Location not provided",
    category: item.category || "General",
    priority:
      item.priority?.charAt(0).toUpperCase() +
      item.priority?.slice(1).toLowerCase(),
    status: statusMap[item.status?.toLowerCase()] || "Assigned",
    description: item.description || "No additional details provided.",
    updated: item.updated_at
      ? `Updated ${new Date(item.updated_at).toLocaleString()}`
      : "Recently reported",
    assignedTechnicianId: item.assigned_technician_id,
  };
}

function formatNotificationTime(dateValue) {
  if (!dateValue) return "Recently";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "Recently";

  const difference = Math.max(0, Date.now() - date.getTime());

  const minutes = Math.floor(difference / 60000);
  const hours = Math.floor(difference / 3600000);
  const days = Math.floor(difference / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

export default function TechnicianDashboard() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");

  const notificationIdsRef = useRef(new Set());
  const hasLoadedNotificationsRef = useRef(false);
  const notificationWrapperRef = useRef(null);

  // Fetch assigned jobs
  const fetchJobs = useCallback(async (signal, showLoading = false) => {
    try {
      if (showLoading) setLoading(true);

      const response = await fetch(API_URL, {
        signal,
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to load maintenance requests."
        );
      }

      if (!Array.isArray(result.data)) {
        throw new Error("Invalid request list received from the API.");
      }

      setJobs(result.data.map(formatJob));
      setError("");
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Could not connect to the backend.");
      }
    } finally {
      if (!signal?.aborted && showLoading) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch notifications and unread count
  const fetchNotifications = useCallback(async (signal, showLoading = false) => {
    try {
      if (showLoading) setNotificationsLoading(true);

      const [notificationsResponse, countResponse] = await Promise.all([
        fetch(NOTIFICATIONS_URL, {
          credentials: "include",
          signal,
        }),
        fetch(`${NOTIFICATIONS_URL}/unread-count`, {
          credentials: "include",
          signal,
        }),
      ]);

      const notificationsResult = await notificationsResponse.json();
      const countResult = await countResponse.json();

      if (!notificationsResponse.ok || !notificationsResult.success) {
        throw new Error(
          notificationsResult.message || "Failed to load notifications."
        );
      }

      if (!countResponse.ok || !countResult.success) {
        throw new Error(
          countResult.message || "Failed to load unread notification count."
        );
      }

      if (!Array.isArray(notificationsResult.notifications)) {
        throw new Error("Invalid notifications response from the server.");
      }

      const receivedNotifications = notificationsResult.notifications;

      // Identify newly received unread notifications.
      if (hasLoadedNotificationsRef.current) {
        const newNotifications = receivedNotifications.filter(
          (notification) =>
            !notification.is_read &&
            !notificationIdsRef.current.has(notification.id)
        );

        if (newNotifications.length > 0) {
          const latest = newNotifications[0];

          window.dispatchEvent(
            new CustomEvent("fixflow-notification", {
              detail: {
                title: latest.title,
                message: latest.message,
              },
            })
          );
        }
      }

      notificationIdsRef.current = new Set(
        receivedNotifications.map((notification) => notification.id)
      );

      hasLoadedNotificationsRef.current = true;

      setNotifications(receivedNotifications);
      setUnreadCount(Number(countResult.unreadCount) || 0);
      setNotificationError("");
    } catch (err) {
      if (err.name !== "AbortError") {
        setNotificationError(
          err.message || "Could not load notifications."
        );
      }
    } finally {
      if (!signal?.aborted && showLoading) {
        setNotificationsLoading(false);
      }
    }
  }, []);

  // Authentication and job polling
  useEffect(() => {
    const controller = new AbortController();

    async function loadAuthenticatedUser() {
      try {
        const response = await fetch(AUTH_ME_URL, {
          credentials: "include",
          signal: controller.signal,
        });

        const result = await response.json();

        if (!response.ok || !result.success || !result.user) {
          window.location.replace("/technician/login");
          return;
        }

        if (result.user.role !== "technician") {
          if (result.user.role === "manager") {
            window.location.replace("/manager");
          } else {
            window.location.replace("/login");
          }
          return;
        }

        setUser(result.user);
        setAuthError("");

        await fetchJobs(controller.signal, true);

        const intervalId = window.setInterval(() => {
          fetchJobs(controller.signal);
        }, 5000);

        controller.signal.addEventListener(
          "abort",
          () => window.clearInterval(intervalId),
          { once: true }
        );
      } catch (err) {
        if (err.name !== "AbortError") {
          setAuthError(
            "Unable to verify your session. Please sign in again."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setAuthLoading(false);
        }
      }
    }

    loadAuthenticatedUser();

    return () => controller.abort();
  }, [fetchJobs]);

  // Notification polling
  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();

    fetchNotifications(controller.signal, true);

    const intervalId = window.setInterval(() => {
      fetchNotifications();
    }, 10000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [user, fetchNotifications]);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        notificationWrapperRef.current &&
        !notificationWrapperRef.current.contains(event.target)
      ) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  // Mark one notification as read
  const handleMarkNotificationRead = async (notificationId) => {
    try {
      const response = await fetch(
        `${NOTIFICATIONS_URL}/${notificationId}/read`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Could not mark notification as read."
        );
      }

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === notificationId
            ? { ...notification, is_read: true }
            : notification
        )
      );

      setUnreadCount((previous) => Math.max(0, previous - 1));
      setNotificationError("");
    } catch (err) {
      setNotificationError(
        err.message || "Could not update notification."
      );
    }
  };

  // Mark all notifications as read
  const handleMarkAllNotificationsRead = async () => {
    if (unreadCount === 0) return;

    try {
      const response = await fetch(`${NOTIFICATIONS_URL}/read-all`, {
        method: "PATCH",
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Could not mark all notifications as read."
        );
      }

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      );

      setUnreadCount(0);
      setNotificationError("");
    } catch (err) {
      setNotificationError(
        err.message || "Could not update notifications."
      );
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await handleMarkNotificationRead(notification.id);
    }

    setNotificationsOpen(false);

    if (notification.request_id) {
      window.location.href = "/work-status";
    }
  };

  // Logout
  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setAuthError("");

    try {
      const response = await fetch(LOGOUT_URL, {
        method: "POST",
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not sign out.");
      }

      window.location.replace("/login");
    } catch (err) {
      setAuthError(
        err.message || "Could not sign out. Please try again."
      );

      setLoggingOut(false);
    }
  };

  // Update job status
  const updateStatus = async (job, nextStatus) => {
    if (updatingId !== null) return;

    const nextDatabaseStatus = databaseStatus[nextStatus];

    if (!nextDatabaseStatus) {
      setActionError("That status is not supported.");
      return;
    }

    setUpdatingId(job.databaseId);
    setActionError("");

    try {
      const response = await fetch(
        `${API_URL}/${job.databaseId}/status`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: nextDatabaseStatus,
            changed_by: user?.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            "The server could not save the status. Check the backend response."
        );
      }

      const controller = new AbortController();

      await Promise.all([
        fetchJobs(controller.signal),
        fetchNotifications(undefined),
      ]);
    } catch (err) {
      setActionError(
        `${job.id}: ${err.message || "Could not save the status."}`
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter and search
  const visibleJobs = jobs.filter((job) => {
    const matchesFilter = filter === "All" || job.status === filter;
    const query = search.toLowerCase();

    const matchesSearch =
      job.title.toLowerCase().includes(query) ||
      job.id.toLowerCase().includes(query) ||
      job.location.toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  // User details
  const displayName = user?.full_name || user?.name || "Technician";
  const displayEmail = user?.email || "";

  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "T";

  const activeCount = jobs.filter(
    (job) => job.status === "Assigned" || job.status === "In progress"
  ).length;

  const progressCount = jobs.filter(
    (job) => job.status === "In progress"
  ).length;

  const resolvedCount = jobs.filter(
    (job) => job.status === "Resolved"
  ).length;

  // Authentication loading
  if (authLoading) {
    return (
      <main className="tech-app" style={{ padding: 32 }}>
        Checking your technician session...
      </main>
    );
  }

  if (authError && !user) {
    return (
      <main className="tech-app" style={{ padding: 32 }}>
        <h2>Unable to open technician workspace</h2>
        <p role="alert">{authError}</p>
        <a href="/technician/login">Return to technician login</a>
      </main>
    );
  }

  return (
    <div className="tech-app">
      <aside className="tech-sidebar">
        <a href="/" className="tech-brand">
          <span className="tech-brand-icon">
            <Zap size={18} fill="currentColor" />
          </span>

          <span>
            FixFlow <b></b>
          </span>
        </a>

        <div className="tech-team-card">
          <div className="tech-team-avatar">T</div>

          <div>
            <strong>Campus Community</strong>
            <span>Technician workspace</span>
          </div>
        </div>

        <span className="tech-nav-label">WORKSPACE</span>

        <nav className="tech-nav">
          <a className="active" href="/technician">
            <LayoutDashboard size={17} />
            Overview
          </a>

          <a href="#assigned-jobs">
            <ClipboardList size={17} />
            Assigned jobs
          </a>

          <a href="/work-status">
            <Clock3 size={17} />
            Public work status
          </a>
        </nav>

        <div className="tech-sidebar-bottom">
          <div className="tech-help">
            <Wrench size={19} />

            <strong>Keep work moving</strong>

            <p>
              Update each job so your community knows what&apos;s happening.
            </p>

            <a href="#assigned-jobs">
              View assigned jobs <ArrowUpRight size={14} />
            </a>
          </div>

          <div className="tech-user">
            <div className="tech-avatar">{initials}</div>

            <div>
              <strong>{displayName}</strong>
              <span>{displayEmail || "Maintenance technician"}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="tech-main">
        <header className="tech-topbar">
          <div className="tech-breadcrumb">
            Workspace <ChevronRight size={14} /> Overview
          </div>

          <div className="tech-topbar-right">
            <span className="tech-online">
              <span /> On duty
            </span>

            <LogoutButton />

            {/* Notification bell */}
            <div
              className="tech-notification-wrapper"
              ref={notificationWrapperRef}
            >
              <button
                className="tech-notification"
                type="button"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((previous) => !previous);

                  if (!notificationsOpen) {
                    fetchNotifications(undefined, true);
                  }
                }}
              >
                <Bell size={18} />

                {unreadCount > 0 && (
                  <span className="tech-notification-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="tech-notification-dropdown">
                  <div className="tech-notification-heading">
                    <div>
                      <h3>Notifications</h3>

                      <p>
                        {unreadCount > 0
                          ? `${unreadCount} unread notification${
                              unreadCount === 1 ? "" : "s"
                            }`
                          : "You're all caught up"}
                      </p>
                    </div>

                    <div className="tech-notification-actions">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllNotificationsRead}
                        >
                          Mark all read
                        </button>
                      )}

                      <button
                        type="button"
                        className="tech-notification-close"
                        aria-label="Close notifications"
                        onClick={() => setNotificationsOpen(false)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {notificationError && (
                    <div className="tech-notification-error" role="alert">
                      {notificationError}
                    </div>
                  )}

                  <div className="tech-notification-list">
                    {notificationsLoading && notifications.length === 0 ? (
                      <div className="tech-notification-empty">
                        <p>Loading notifications...</p>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="tech-notification-empty">
                        <Bell size={25} />

                        <strong>No notifications yet</strong>

                        <p>
                          Notifications about assigned jobs will appear here.
                        </p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          type="button"
                          key={notification.id}
                          className={`tech-notification-item ${
                            !notification.is_read ? "unread" : ""
                          }`}
                          onClick={() =>
                            handleNotificationClick(notification)
                          }
                        >
                          <span className="tech-notification-icon">
                            <Wrench size={17} />
                          </span>

                          <span className="tech-notification-content">
                            <strong>{notification.title}</strong>

                            <span>{notification.message}</span>

                            <small>
                              {formatNotificationTime(
                                notification.created_at
                              )}
                            </small>
                          </span>

                          {!notification.is_read && (
                            <span className="tech-notification-unread-dot" />
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  <div className="tech-notification-footer">
                    Your latest maintenance updates
                  </div>
                </div>
              )}
            </div>

            <div
              className="tech-avatar"
              title={displayEmail || displayName}
            >
              {initials}
            </div>

            <button
              className="tech-notification"
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="tech-content">
          <section className="tech-welcome">
            <div>
              <span className="tech-eyebrow">TECHNICIAN WORKSPACE</span>

              <h1>
                Welcome, {displayName.split(" ")[0]} <span>✳</span>
              </h1>

              <p>
                Your assigned work, all in one place. Let&apos;s get things
                fixed.
              </p>
            </div>

            <a className="tech-public-link" href="/work-status">
              Public work board <ArrowUpRight size={16} />
            </a>
          </section>

          <section className="tech-stats">
            <article className="tech-stat-card">
              <div className="tech-stat-top">
                <span>Active assignments</span>

                <span className="tech-stat-icon blue">
                  <ClipboardList size={17} />
                </span>
              </div>

              <strong>{activeCount.toString().padStart(2, "0")}</strong>

              <p>Jobs requiring attention</p>
            </article>

            <article className="tech-stat-card">
              <div className="tech-stat-top">
                <span>In progress</span>

                <span className="tech-stat-icon amber">
                  <Clock3 size={17} />
                </span>
              </div>

              <strong>{progressCount.toString().padStart(2, "0")}</strong>

              <p>Currently being worked on</p>
            </article>

            <article className="tech-stat-card">
              <div className="tech-stat-top">
                <span>Resolved</span>

                <span className="tech-stat-icon green">
                  <CheckCircle2 size={17} />
                </span>
              </div>

              <strong>{resolvedCount.toString().padStart(2, "0")}</strong>

              <p>Resolved requests</p>
            </article>
          </section>

          <section className="tech-focus-banner">
            <div className="tech-focus-icon">
              <Wrench size={21} />
            </div>

            <div>
              <strong>Every update keeps the community informed</strong>

              <p>
                Start work when you begin, and mark a job resolved when
                it&apos;s fixed.
              </p>
            </div>
          </section>

          {authError && user && (
            <div
              role="alert"
              style={{
                padding: 14,
                marginTop: 16,
                color: "crimson",
                background: "#fff1f0",
                borderRadius: 8,
              }}
            >
              {authError}
            </div>
          )}

          {actionError && (
            <div
              role="alert"
              style={{
                padding: 14,
                marginTop: 16,
                color: "crimson",
                background: "#fff1f0",
                borderRadius: 8,
              }}
            >
              <strong>Could not update job</strong>
              <p>{actionError}</p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{
                padding: 14,
                marginTop: 16,
                color: "crimson",
                background: "#fff1f0",
                borderRadius: 8,
              }}
            >
              <strong>Could not load jobs.</strong>

              <p>{error}</p>

              <button
                onClick={() => {
                  const controller = new AbortController();
                  fetchJobs(controller.signal, true);
                }}
              >
                Retry
              </button>
            </div>
          )}

          <section className="tech-jobs-section" id="assigned-jobs">
            <div className="tech-section-heading">
              <div>
                <h2>My assigned jobs</h2>

                <p>
                  Review the details and keep each job&apos;s status up to
                  date.
                </p>
              </div>

              <span className="tech-job-count">
                {visibleJobs.length} jobs
              </span>
            </div>

            <div className="tech-job-toolbar">
              <label className="tech-search">
                <Search size={17} />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search jobs or locations..."
                  aria-label="Search assigned jobs"
                />
              </label>

              <div className="tech-filters">
                {["All", "Assigned", "In progress", "Resolved"].map(
                  (item) => (
                    <button
                      key={item}
                      className={filter === item ? "selected" : ""}
                      onClick={() => setFilter(item)}
                    >
                      {item}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="tech-job-list">
              {loading && (
                <p style={{ padding: 16 }}>
                  Loading maintenance requests...
                </p>
              )}

              {!loading &&
                !error &&
                visibleJobs.map((job) => (
                  <article className="tech-job-card" key={job.id}>
                    <div
                      className={`tech-job-symbol ${
                        statusClass[job.status] || "assigned"
                      }`}
                    >
                      {job.status === "Resolved" ? (
                        <CheckCircle2 size={21} />
                      ) : (
                        <Wrench size={21} />
                      )}
                    </div>

                    <div className="tech-job-body">
                      <div className="tech-job-title-row">
                        <div>
                          <span className="tech-job-id">{job.id}</span>

                          <h3>{job.title}</h3>
                        </div>

                        <div className="tech-job-badges">
                          <span
                            className={`tech-priority ${
                              (job.priority || "Medium").toLowerCase()
                            }`}
                          >
                            {job.priority || "Medium"}
                          </span>

                          <span
                            className={`tech-status ${
                              statusClass[job.status] || "assigned"
                            }`}
                          >
                            <span /> {job.status}
                          </span>
                        </div>
                      </div>

                      <p className="tech-job-description">
                        {job.description}
                      </p>

                      <div className="tech-job-meta">
                        <span>
                          <MapPin size={14} /> {job.location}
                        </span>

                        <span>
                          <Wrench size={14} /> {job.category}
                        </span>
                      </div>

                      <div className="tech-job-footer">
                        <span className="tech-job-updated">
                          {job.updated}
                        </span>

                        {job.status === "Assigned" && (
                          <button
                            className="tech-action-button"
                            disabled={updatingId === job.databaseId}
                            onClick={() =>
                              updateStatus(job, "In progress")
                            }
                          >
                            <Play size={14} />

                            {updatingId === job.databaseId
                              ? "Saving..."
                              : "Start work"}
                          </button>
                        )}

                        {job.status === "In progress" && (
                          <button
                            className="tech-action-button complete"
                            disabled={updatingId === job.databaseId}
                            onClick={() =>
                              updateStatus(job, "Resolved")
                            }
                          >
                            <CheckCircle2 size={15} />

                            {updatingId === job.databaseId
                              ? "Saving..."
                              : "Mark resolved"}
                          </button>
                        )}

                        {job.status === "Resolved" && (
                          <span className="tech-completed-label">
                            <CheckCircle2 size={15} /> Completed
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                ))}

              {!loading && !error && visibleJobs.length === 0 && (
                <div className="tech-empty-state">
                  <AlertCircle size={25} />

                  <strong>No matching jobs</strong>

                  <p>Try a different search or status filter.</p>
                </div>
              )}
            </div>

            <RecentlyCompleted />
          </section>

          <footer className="tech-footer">
            <a href="/" className="tech-footer-brand">
              FixFlow <b></b>
            </a>

            <span>Less chasing. More fixing.</span>

            <span>{displayEmail || "Technician workspace"}</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
