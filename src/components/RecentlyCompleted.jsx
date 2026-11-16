
import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, MapPin } from "lucide-react";

const API_BASE_URL = "http://localhost:5000";

function formatCompletionDate(date) {
  if (!date) return "Completion date unavailable";

  return new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RecentlyCompleted() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchCompletedRequests() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/maintenance-requests/completed/recent`,
          { credentials: "include" }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Could not load completed requests."
          );
        }

        if (!cancelled) {
          setRequests(result.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load completed requests.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchCompletedRequests();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="recently-completed">
      <div className="recently-completed-heading">
        <div>
          <p className="recently-completed-eyebrow">WORK HISTORY</p>
          <h2>Recently Completed</h2>
          <p>Maintenance requests resolved by your community team.</p>
        </div>

        <CheckCircle2 size={24} />
      </div>

      {loading && (
        <p className="recently-completed-message">
          Loading completed requests...
        </p>
      )}

      {!loading && error && (
        <p className="recently-completed-message" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && requests.length === 0 && (
        <div className="recently-completed-empty">
          <CheckCircle2 size={28} />
          <p>No completed requests yet.</p>
          <span>Resolved maintenance work will appear here.</span>
        </div>
      )}

      {!loading && !error && requests.length > 0 && (
        <div className="recently-completed-list">
          {requests.map((request) => (
            <article
              className="completed-request-card"
              key={request.id}
            >
              <div className="completed-request-icon">
                <CheckCircle2 size={20} />
              </div>

              <div className="completed-request-content">
                <div className="completed-request-title-row">
                  <h3>{request.title}</h3>
                  <span className="completed-request-status">
                    Resolved
                  </span>
                </div>

                <div className="completed-request-meta">
                  {request.category && (
                    <span>{request.category}</span>
                  )}

                  {request.location && (
                    <span>
                      <MapPin size={14} />
                      {request.location}
                    </span>
                  )}
                </div>

                <div className="completed-request-footer">
                  <span>
                    <Clock3 size={14} />
                    {formatCompletionDate(request.completed_at)}
                  </span>

                  <span>
                    Completed by:{" "}
                    {request.completed_by_name || "Not recorded"}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
