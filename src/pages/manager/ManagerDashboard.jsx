import LogoutButton from "../../components/LogoutButton";
import RecentlyCompleted from "../../components/RecentlyCompleted";
import "./ManagerDashboard.css";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Zap,
  LayoutDashboard,
  ClipboardList,
  Users,
  BarChart3,
  Settings,
  Search,
  Bell,
  ChevronDown,
  MapPin,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  CircleDot,
  Wrench,
  ArrowUpRight,
  Filter,
  MoreHorizontal,
  X,
  RefreshCw,
  UserRound,
  Mail,
  ShieldCheck,
} from "lucide-react";

const API_BASE_URL = "";
const API_URL = `${API_BASE_URL}/api/maintenance-requests`;
const AUTH_ME_URL = `${API_BASE_URL}/api/auth/me`;
const LOGOUT_URL = `${API_BASE_URL}/api/auth/logout`;
const NOTIFICATIONS_URL = `${API_BASE_URL}/api/notifications`;

function formatStatus(status = "open") {
  const normalized = String(status)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const labels = {
    open: "Open",
    assigned: "Assigned",
    in_progress: "In progress",
    resolved: "Resolved",
    closed: "Closed",
  };

  return labels[normalized] || status;
}

function formatPriority(priority = "medium") {
  const value = String(priority);
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatRequest(item) {
  return {
    id: `FF-${String(item.id).padStart(4, "0")}`,
    databaseId: item.id,
    title: item.title || "Untitled request",
    category: item.category || "General",
    location: item.location || "Location not provided",
    reporter: item.reporter_name || "Resident",
    priority: formatPriority(item.priority),
    status: formatStatus(item.status),
    technicianId: item.assigned_technician_id ?? "",
    technician: item.technician_name || "Unassigned",
    date: item.created_at
      ? new Date(item.created_at).toLocaleString()
      : "—",
    description: item.description || "",
  };
}

function ManagerDashboard() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const dashboardRef = useRef(null);
  const requestsPanelRef = useRef(null);
  const teamOverviewRef = useRef(null);

  const [requests, setRequests] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [techniciansLoading, setTechniciansLoading] = useState(true);
  const [assigningRequestId, setAssigningRequestId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("All requests");
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [notice, setNotice] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");

  const notificationIdsRef = useRef(new Set());
  const hasLoadedNotificationsRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fetchRequests = useCallback(async (signal) => {
    try {
      const response = await fetch(API_URL, {
        signal,
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load requests.");
      }

      if (!Array.isArray(result.data)) {
        throw new Error("The API response does not contain a request list.");
      }

      const formattedRequests = result.data.map(formatRequest);

      setRequests(formattedRequests);
      setError("");

      setSelectedRequest((current) => {
        if (!current) return null;

        return (
          formattedRequests.find(
            (request) =>
              String(request.databaseId) === String(current.databaseId)
          ) || null
        );
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Could not connect to the backend.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const fetchTechnicians = useCallback(async (signal) => {
    try {
      const response = await fetch(`${API_URL}/technicians`, {
        credentials: "include",
        signal,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load technicians.");
      }

      setTechnicians(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      if (err.name !== "AbortError") {
        setNotice(err.message || "Could not load technicians.");
      }
    } finally {
      if (!signal?.aborted) {
        setTechniciansLoading(false);
      }
    }
  }, []);

  const fetchNotifications = useCallback(async (signal) => {
    try {
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

      const [notificationsResult, countResult] = await Promise.all([
        notificationsResponse.json(),
        countResponse.json(),
      ]);

      if (!notificationsResponse.ok || !notificationsResult.success) {
        throw new Error(
          notificationsResult.message || "Failed to fetch notifications."
        );
      }

      if (!countResponse.ok || !countResult.success) {
        throw new Error(
          countResult.message || "Failed to fetch unread count."
        );
      }

      const fetchedNotifications = Array.isArray(
        notificationsResult.notifications
      )
        ? notificationsResult.notifications
        : [];

      // Show a toast only for notifications received after the first fetch.
      if (hasLoadedNotificationsRef.current) {
        const newNotifications = fetchedNotifications.filter(
          (notification) =>
            !notification.is_read &&
            !notificationIdsRef.current.has(String(notification.id))
        );

        if (newNotifications.length > 0) {
          setNotice(
            newNotifications[0].title || "New notification received."
          );
        }
      }

      notificationIdsRef.current = new Set(
        fetchedNotifications.map((notification) => String(notification.id))
      );

      hasLoadedNotificationsRef.current = true;
      setNotifications(fetchedNotifications);
      setUnreadCount(Number(countResult.unreadCount) || 0);
      setNotificationError("");
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Notification fetch failed:", err);
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

  useEffect(() => {
    if (!user) return undefined;

    const controller = new AbortController();

    setNotificationsLoading(true);
    fetchNotifications(controller.signal);

    const intervalId = window.setInterval(() => {
      fetchNotifications(controller.signal);
    }, 10000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [user, fetchNotifications]);

  async function handleMarkAsRead(notificationId) {
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
        throw new Error(result.message || "Could not mark as read.");
      }

      const target = notifications.find(
        (notification) =>
          String(notification.id) === String(notificationId)
      );

      if (target && !target.is_read) {
        setNotifications((current) =>
          current.map((notification) =>
            String(notification.id) === String(notificationId)
              ? { ...notification, is_read: true }
              : notification
          )
        );

        setUnreadCount((count) => Math.max(0, count - 1));
      }
    } catch (err) {
      setNotice(err.message || "Failed to update notification.");
    }
  }

  async function handleMarkAllAsRead() {
    try {
      const response = await fetch(`${NOTIFICATIONS_URL}/read-all`, {
        method: "PATCH",
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not mark all as read.");
      }

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      );

      setUnreadCount(0);
      setNotice("All notifications marked as read.");
    } catch (err) {
      setNotice(err.message || "Failed to update notifications.");
    }
  }

  function handleOpenNotification(notification) {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }

    setNotificationsOpen(false);

    const linkedRequest = requests.find(
      (request) =>
        String(request.databaseId) === String(notification.request_id)
    );

    if (linkedRequest) {
      setSelectedRequest(linkedRequest);
    } else {
      setNotice("The related request is not currently available.");
    }
  }

  async function handleTechnicianAssignment(request, value) {
    const technicianId = value === "" ? null : Number(value);

    setAssigningRequestId(request.databaseId);
    setNotice("");

    try {
      const response = await fetch(
        `${API_URL}/${request.databaseId}/assign`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            technician_id: technicianId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to assign technician.");
      }

      setNotice(result.message || "Technician assignment saved.");

      await fetchRequests();
    } catch (err) {
      setNotice(err.message || "Could not save technician assignment.");
    } finally {
      setAssigningRequestId(null);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    let intervalId;

    async function verifyManager() {
      try {
        const response = await fetch(AUTH_ME_URL, {
          credentials: "include",
          signal: controller.signal,
        });

        const result = await response.json();

        if (!response.ok || !result.success || !result.user) {
          window.location.replace("/manager/login");
          return;
        }

        if (result.user.role !== "manager") {
          window.location.replace(
            result.user.role === "technician" ? "/technician" : "/login"
          );
          return;
        }

        setUser(result.user);

        await Promise.all([
          fetchRequests(controller.signal),
          fetchTechnicians(controller.signal),
        ]);

        intervalId = window.setInterval(() => {
          fetchRequests(controller.signal);
        }, 5000);
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

    verifyManager();

    return () => {
      controller.abort();

      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [fetchRequests, fetchTechnicians]);

  async function handleLogout() {
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
      setAuthError(err.message || "Could not sign out. Please try again.");
      setLoggingOut(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);

    await Promise.all([fetchRequests(), fetchTechnicians()]);
  }

  function scrollToSection(ref) {
    ref.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function goToRequests() {
    setActiveFilter("All requests");
    setSearch("");
    scrollToSection(requestsPanelRef);
  }

  function goToOpenRequests() {
    setActiveFilter("Open");
    setSearch("");
    scrollToSection(requestsPanelRef);
  }

  const userName = user?.full_name || "Manager";

  const userInitials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "M";

  const filteredRequests = requests.filter((request) => {
    const matchesFilter =
      activeFilter === "All requests" || request.status === activeFilter;

    const query = search.toLowerCase();

    const matchesSearch =
      request.title.toLowerCase().includes(query) ||
      request.id.toLowerCase().includes(query) ||
      request.location.toLowerCase().includes(query) ||
      request.technician.toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  const openCount = requests.filter(
    (request) => request.status === "Open"
  ).length;

  const progressCount = requests.filter(
    (request) => request.status === "In progress"
  ).length;

  const resolvedCount = requests.filter(
    (request) => request.status === "Resolved"
  ).length;

  const unassignedCount = requests.filter(
    (request) =>
      !request.technicianId &&
      request.status !== "Resolved" &&
      request.status !== "Closed"
  ).length;

  function updateRequest(id, field, value) {
    setRequests((current) =>
      current.map((request) =>
        request.id === id ? { ...request, [field]: value } : request
      )
    );

    setSelectedRequest((current) =>
      current && current.id === id
        ? { ...current, [field]: value }
        : current
    );

    setNotice("This change is only in the current view and is not saved.");
  }

  useEffect(() => {
    if (!notice) return undefined;

    const timeoutId = setTimeout(() => setNotice(""), 3000);

    return () => clearTimeout(timeoutId);
  }, [notice]);

  function exportRequests() {
    const headers = [
      "ID",
      "Title",
      "Category",
      "Location",
      "Priority",
      "Status",
      "Technician",
    ];

    const rows = requests.map((request) => [
      request.id,
      request.title,
      request.category,
      request.location,
      request.priority,
      request.status,
      request.technician,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = "fixflow-requests.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  if (authLoading) {
    return (
      <div className="manager-app" style={{ padding: 32 }}>
        Checking manager session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="manager-app" style={{ padding: 32 }} role="alert">
        {authError || "Redirecting to manager login…"}
      </div>
    );
  }

  return (
    <div className="manager-app" ref={dashboardRef}>
      <aside className="manager-sidebar">
        <a
          className="manager-brand"
          href="#overview"
          onClick={(event) => {
            event.preventDefault();
            scrollToSection(dashboardRef);
          }}
        >
          <span className="manager-brand-icon">
            <Zap size={21} fill="currentColor" />
          </span>

          <span>
            fixflow<span className="manager-brand-ai"></span>
          </span>
        </a>

        <div className="manager-workspace">
          <div className="manager-workspace-avatar">{userInitials}</div>

          <div className="manager-workspace-info">
            <strong>FixFlow Workspace</strong>
            <span>{user.email || "Manager account"}</span>
          </div>

          <ChevronDown size={16} />
        </div>

        <span className="manager-nav-label">WORKSPACE</span>

        <nav className="manager-nav">
          <button
            type="button"
            className="manager-nav-item active"
            onClick={() => scrollToSection(dashboardRef)}
          >
            <LayoutDashboard size={18} />
            Overview
          </button>

          <button
            type="button"
            className="manager-nav-item"
            onClick={goToRequests}
          >
            <ClipboardList size={18} />
            All requests
            <span className="manager-nav-count">{requests.length}</span>
          </button>

          <button
            type="button"
            className="manager-nav-item"
            onClick={() => scrollToSection(teamOverviewRef)}
          >
            <Users size={18} />
            Technicians
          </button>

          <a className="manager-nav-item" href="/work-status">
            <BarChart3 size={18} />
            Public status board
          </a>
        </nav>

        <span className="manager-nav-label manager-nav-label-bottom">
          PREFERENCES
        </span>

        <nav className="manager-nav">
          <button
            type="button"
            className="manager-nav-item"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={18} />
            Settings
          </button>
        </nav>

        <div className="manager-sidebar-bottom">
          <div className="manager-help-card">
            <div className="manager-help-icon">
              <Zap size={17} />
            </div>

            <strong>FixFlow AI</strong>
            <p>Keep your community running smoothly.</p>
            <a href="/work-status">View public board ↗</a>
          </div>

          <div className="manager-profile">
            <div className="manager-profile-avatar">{userInitials}</div>

            <div className="manager-profile-info">
              <strong>{userName}</strong>
              <span>{user.email || "Workspace admin"}</span>
            </div>

            <button
              type="button"
              className="manager-icon-button"
              onClick={handleLogout}
              disabled={loggingOut}
              title="Sign out"
              aria-label="Sign out"
            >
              {loggingOut ? "…" : "↗"}
            </button>
          </div>
        </div>
      </aside>

      <main className="manager-main">
        <header className="manager-topbar">
          <div className="manager-breadcrumb">
            Workspace <span>/</span> <strong>Overview</strong>
          </div>

          <div className="manager-topbar-actions">
            <span className="manager-live-indicator">
              <span /> System operational
            </span>

            <LogoutButton />

            <button
              type="button"
              className="manager-icon-button"
              aria-label="Refresh requests"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh requests"
            >
              <RefreshCw size={18} />
            </button>

            <div className="manager-notification-wrapper">
              <button
                type="button"
                className="manager-icon-button manager-notification-button"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                onClick={() =>
                  setNotificationsOpen((current) => !current)
                }
              >
                <Bell size={19} />

                {unreadCount > 0 && (
                  <span className="manager-notification-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="manager-notification-dropdown">
                  <div className="manager-notification-heading">
                    <div>
                      <strong>Notifications</strong>
                      <span>
                        {unreadCount} unread notification
                        {unreadCount === 1 ? "" : "s"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      aria-label="Close notifications"
                    >
                      <X size={17} />
                    </button>
                  </div>

                  {unreadCount > 0 && (
                    <div className="manager-notification-actions">
                      <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                      >
                        Mark all as read
                      </button>
                    </div>
                  )}

                  <div className="manager-notification-list">
                    {notificationsLoading && notifications.length === 0 ? (
                      <p className="manager-notification-empty">
                        Loading notifications...
                      </p>
                    ) : notificationError && notifications.length === 0 ? (
                      <p className="manager-notification-error">
                        {notificationError}
                      </p>
                    ) : notifications.length === 0 ? (
                      <div className="manager-notification-empty">
                        <Bell size={23} />
                        <strong>You're all caught up!</strong>
                        <span>No notifications yet.</span>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          type="button"
                          key={notification.id}
                          className={`manager-notification-item ${
                            notification.is_read ? "read" : "unread"
                          }`}
                          onClick={() =>
                            handleOpenNotification(notification)
                          }
                        >
                          <span className="manager-notification-icon">
                            <ClipboardList size={17} />
                          </span>

                          <span className="manager-notification-content">
                            <strong>{notification.title}</strong>
                            <span>{notification.message}</span>
                            <small>
                              {notification.created_at
                                ? new Date(
                                    notification.created_at
                                  ).toLocaleString()
                                : ""}
                            </small>
                          </span>

                          {!notification.is_read && (
                            <span className="manager-notification-unread-dot" />
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  <div className="manager-notification-footer">
                    Showing your latest 50 notifications
                  </div>
                </div>
              )}
            </div>

            <div className="manager-topbar-avatar">{userInitials}</div>
          </div>
        </header>

        <div className="manager-content">
          <section className="manager-welcome" id="overview">
            <div>
              <div className="manager-eyebrow">MANAGER WORKSPACE</div>

              <h1>
                Good afternoon, {userName.split(" ")[0]} <span>✳</span>
              </h1>

              <p>Here’s what’s happening across your community today.</p>
            </div>

            <button
              type="button"
              className="manager-export-button"
              onClick={exportRequests}
            >
              <ArrowUpRight size={17} /> Export report
            </button>
          </section>

          {authError && (
            <div role="alert" style={{ padding: 12, color: "crimson" }}>
              {authError}
            </div>
          )}

          {error && (
            <div role="alert" style={{ padding: 16, color: "crimson" }}>
              Could not load requests: {error}

              <button
                type="button"
                style={{ marginLeft: 12 }}
                onClick={handleRefresh}
              >
                Retry
              </button>
            </div>
          )}

          <section className="manager-stats">
            <article className="manager-stat-card">
              <div className="manager-stat-top">
                <span>Total requests</span>
                <span className="manager-stat-icon blue">
                  <ClipboardList size={19} />
                </span>
              </div>

              <strong>{requests.length}</strong>

              <div className="manager-stat-foot">
                <span className="manager-neutral-dot" />
                All submitted requests
              </div>
            </article>

            <article
              className="manager-stat-card"
              style={{ cursor: "pointer" }}
              onClick={goToOpenRequests}
            >
              <div className="manager-stat-top">
                <span>Open requests</span>
                <span className="manager-stat-icon orange">
                  <AlertTriangle size={19} />
                </span>
              </div>

              <strong>{openCount}</strong>

              <div className="manager-stat-foot manager-warning-text">
                <span className="manager-warning-dot" />
                Needs attention
              </div>
            </article>

            <article className="manager-stat-card">
              <div className="manager-stat-top">
                <span>In progress</span>
                <span className="manager-stat-icon purple">
                  <Clock3 size={19} />
                </span>
              </div>

              <strong>{progressCount}</strong>

              <div className="manager-stat-foot">
                <span className="manager-purple-dot" />
                Being worked on
              </div>
            </article>

            <article className="manager-stat-card">
              <div className="manager-stat-top">
                <span>Resolved</span>
                <span className="manager-stat-icon green">
                  <CheckCircle2 size={19} />
                </span>
              </div>

              <strong>{resolvedCount}</strong>

              <div className="manager-stat-foot manager-success-text">
                <span className="manager-success-dot" />
                Completed requests
              </div>
            </article>
          </section>

          <section className="manager-attention-banner">
            <div className="manager-attention-icon">
              <AlertTriangle size={21} />
            </div>

            <div className="manager-attention-copy">
              <strong>
                {unassignedCount} request
                {unassignedCount === 1 ? "" : "s"} need assignment
              </strong>

              <p>
                Assign a technician to keep work moving and prevent delays.
              </p>
            </div>

            <button type="button" onClick={goToOpenRequests}>
              Review requests <ArrowUpRight size={16} />
            </button>
          </section>

          <section
            className="manager-requests-panel"
            ref={requestsPanelRef}
            id="request-management"
          >
            <div className="manager-panel-heading">
              <div>
                <h2>Request management</h2>
                <p>Review issues, assign technicians, and track progress.</p>
              </div>
            </div>

            <div className="manager-table-toolbar">
              <div className="manager-filter-tabs">
                {["All requests", "Open", "In progress", "Resolved"].map(
                  (filter) => (
                    <button
                      type="button"
                      key={filter}
                      className={activeFilter === filter ? "selected" : ""}
                      onClick={() => setActiveFilter(filter)}
                    >
                      {filter}

                      {filter === "All requests" && (
                        <span>{requests.length}</span>
                      )}
                    </button>
                  )
                )}
              </div>

              <div className="manager-table-actions">
                <label className="manager-search">
                  <Search size={17} />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search requests..."
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>

                <button
                  type="button"
                  className="manager-filter-button"
                  onClick={() => {
                    setActiveFilter("All requests");
                    setSearch("");
                  }}
                >
                  <Filter size={16} /> Reset
                </button>
              </div>
            </div>

            <div className="manager-table-wrap">
              {loading ? (
                <p style={{ padding: 20 }}>Loading requests...</p>
              ) : (
                <table className="manager-table">
                  <thead>
                    <tr>
                      <th>REQUEST</th>
                      <th>PRIORITY</th>
                      <th>STATUS</th>
                      <th>ASSIGNED TO</th>
                      <th>REPORTED</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRequests.map((request) => (
                      <tr key={request.id}>
                        <td>
                          <button
                            type="button"
                            className="manager-request-title"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <span className="manager-request-category">
                              {request.category === "Electrical" ||
                              request.category === "Electrical & IT" ? (
                                <Zap size={16} />
                              ) : request.category === "Plumbing" ? (
                                <Wrench size={16} />
                              ) : (
                                <CircleDot size={16} />
                              )}
                            </span>

                            <span>
                              <strong>{request.title}</strong>

                              <small>
                                {request.id} · <MapPin size={11} />{" "}
                                {request.location}
                              </small>
                            </span>
                          </button>
                        </td>

                        <td>
                          <span
                            className={`manager-priority ${request.priority.toLowerCase()}`}
                          >
                            <i />
                            {request.priority}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`manager-status ${request.status
                              .toLowerCase()
                              .replace(/\s+/g, "-")}`}
                          >
                            <i />
                            {request.status}
                          </span>
                        </td>

                        <td>
                          <select
                            className="manager-assignee-select"
                            value={request.technicianId ?? ""}
                            aria-label={`Assign technician for ${request.id}`}
                            disabled={
                              techniciansLoading ||
                              assigningRequestId === request.databaseId
                            }
                            onChange={(event) =>
                              handleTechnicianAssignment(
                                request,
                                event.target.value
                              )
                            }
                          >
                            <option value="">Unassigned</option>

                            {technicians.map((technician) => (
                              <option
                                key={technician.id}
                                value={technician.id}
                              >
                                {technician.full_name} ({technician.email})
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>
                          <span className="manager-date">{request.date}</span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="manager-row-menu"
                            aria-label={`Manage ${request.id}`}
                            onClick={() => setSelectedRequest(request)}
                          >
                            <MoreHorizontal size={19} />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {filteredRequests.length === 0 && (
                      <tr>
                        <td colSpan="6" className="manager-empty">
                          {search || activeFilter !== "All requests"
                            ? "No requests match your search or filter."
                            : "No requests have been submitted yet."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="manager-table-footer">
              <span>
                Showing <strong>{filteredRequests.length}</strong> of{" "}
                <strong>{requests.length}</strong> requests
              </span>

              <a href="/work-status">
                View public status board <ArrowUpRight size={14} />
              </a>
            </div>
          </section>

          <section className="manager-bottom-grid">
            <div
              className="manager-bottom-card"
              ref={teamOverviewRef}
              id="team-overview"
            >
              <div className="manager-bottom-card-heading">
                <div>
                  <h3>Team overview</h3>
                  <p>Technician workload at a glance</p>
                </div>

                <span>
                  <Users size={17} />
                </span>
              </div>

              {techniciansLoading ? (
                <p>Loading technicians...</p>
              ) : (
                technicians.map((technician, index) => {
                  const assigned = requests.filter(
                    (request) =>
                      String(request.technicianId) === String(technician.id) &&
                      request.status !== "Resolved" &&
                      request.status !== "Closed"
                  ).length;

                  const initials = (technician.full_name || "T")
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase();

                  return (
                    <div className="manager-team-row" key={technician.id}>
                      <div
                        className={`manager-team-avatar avatar-${index % 3}`}
                      >
                        {initials}
                      </div>

                      <div className="manager-team-name">
                        <strong>{technician.full_name}</strong>
                        <span>{technician.email}</span>
                      </div>

                      <span className="manager-team-work">
                        {assigned} active
                      </span>
                    </div>
                  );
                })
              )}

              {!techniciansLoading && technicians.length === 0 && (
                <p>
                  No technicians are registered for this organization yet.
                </p>
              )}
            </div>

            <div className="manager-bottom-card manager-completion-card">
              <div className="manager-bottom-card-heading">
                <div>
                  <h3>Resolution snapshot</h3>
                  <p>Based on live requests</p>
                </div>

                <span className="manager-snapshot-icon">
                  <BarChart3 size={18} />
                </span>
              </div>

              <div className="manager-completion-number">
                {requests.length
                  ? Math.round((resolvedCount / requests.length) * 100)
                  : 0}
                % <span>resolved</span>
              </div>

              <div className="manager-progress-track">
                <div
                  style={{
                    width: `${
                      requests.length
                        ? (resolvedCount / requests.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="manager-progress-labels">
                <span>{resolvedCount} completed</span>
                <span>{requests.length - resolvedCount} remaining</span>
              </div>

              <div className="manager-snapshot-note">
                <CheckCircle2 size={15} />
                Metrics update from loaded requests.
              </div>
            </div>
          </section>

          <RecentlyCompleted />
        </div>
      </main>

      {notice && (
        <div className="manager-toast" role="status">
          <CheckCircle2 size={17} /> {notice}
        </div>
      )}

      {selectedRequest && (
        <div
          className="manager-modal-backdrop"
          onClick={() => setSelectedRequest(null)}
        >
          <section
            className="manager-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="manager-modal-heading">
              <div>
                <span>{selectedRequest.id}</span>
                <h2>{selectedRequest.title}</h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <p className="manager-modal-location">
              <MapPin size={15} /> {selectedRequest.location}
            </p>

            {selectedRequest.description && (
              <p>{selectedRequest.description}</p>
            )}

            <div className="manager-modal-field">
              <label>Priority</label>

              <select
                value={selectedRequest.priority}
                onChange={(event) =>
                  updateRequest(
                    selectedRequest.id,
                    "priority",
                    event.target.value
                  )
                }
              >
                {["Low", "Medium", "High", "Urgent"].map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </div>

            <div className="manager-modal-field">
              <label>Work status</label>

              <select
                value={selectedRequest.status}
                onChange={(event) =>
                  updateRequest(
                    selectedRequest.id,
                    "status",
                    event.target.value
                  )
                }
              >
                {["Open", "Assigned", "In progress", "Resolved", "Closed"].map(
                  (status) => (
                    <option key={status}>{status}</option>
                  )
                )}
              </select>
            </div>

            <div className="manager-modal-field">
              <label>Assigned technician</label>

              <select
                value={selectedRequest.technicianId ?? ""}
                disabled={
                  techniciansLoading ||
                  assigningRequestId === selectedRequest.databaseId
                }
                onChange={(event) =>
                  handleTechnicianAssignment(
                    selectedRequest,
                    event.target.value
                  )
                }
              >
                <option value="">Unassigned</option>

                {technicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.full_name} ({technician.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="manager-modal-meta">
              <span>Reported by</span>
              <strong>{selectedRequest.reporter}</strong>
            </div>

            <div className="manager-modal-meta">
              <span>Reported</span>
              <strong>{selectedRequest.date}</strong>
            </div>

            <button
              type="button"
              className="manager-modal-done"
              onClick={() => setSelectedRequest(null)}
            >
              Done
            </button>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div
          className="manager-modal-backdrop"
          onClick={() => setSettingsOpen(false)}
        >
          <section
            className="manager-modal manager-settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manager-settings-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="manager-modal-heading">
              <div>
                <span>ACCOUNT PREFERENCES</span>
                <h2 id="manager-settings-title">Settings</h2>
              </div>

              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
              >
                <X size={20} />
              </button>
            </div>

            <p>View your FixFlow manager account details.</p>

            <div className="manager-modal-meta">
              <span>
                <UserRound size={15} /> Full name
              </span>
              <strong>{userName}</strong>
            </div>

            <div className="manager-modal-meta">
              <span>
                <Mail size={15} /> Email address
              </span>
              <strong>{user.email || "Not available"}</strong>
            </div>

            <div className="manager-modal-meta">
              <span>
                <ShieldCheck size={15} /> Account role
              </span>
              <strong>{user.role || "Manager"}</strong>
            </div>

            <p style={{ fontSize: 13, opacity: 0.75, marginTop: 16 }}>
              Profile editing and password changes are not configured here yet.
            </p>

            <button
              type="button"
              className="manager-modal-done"
              onClick={() => setSettingsOpen(false)}
            >
              Done
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

export default ManagerDashboard;