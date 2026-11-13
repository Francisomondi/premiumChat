
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../store/useAuthStore";
import {
  getCreatorApplications,
  reviewCreatorApplication,
} from "../../api/services/adminService";

const PAGE_SIZE = 20;

const FILTERS = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

function getApplications(response) {
  const data = response?.data || response;

  if (Array.isArray(data)) return data;

  return (
    data?.applications ||
    data?.items ||
    data?.results ||
    response?.applications ||
    []
  );
}

function getPagination(response, currentPage) {
  const data = response?.data || response;
  const pagination = data?.pagination || {};

  return {
    page: Number(pagination.page || currentPage),
    pages: Number(pagination.pages || pagination.totalPages || 1),
    total: Number(pagination.total || pagination.totalApplications || 0),
  };
}

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getApplicant(application) {
  return (
    application.applicant ||
    application.user ||
    application.creator ||
    application.userId ||
    {}
  );
}

function StatusBadge({ status }) {
  const styles = {
    PENDING: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    APPROVED: "border-green-500/20 bg-green-500/10 text-green-300",
    REJECTED: "border-red-500/20 bg-red-500/10 text-red-300",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        styles[status] || "border-white/10 bg-white/5 text-gray-300"
      }`}
    >
      {status || "UNKNOWN"}
    </span>
  );
}

function AdminStat({ label, value, description }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#19151e] p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-white">{value}</p>
      <p className="mt-2 text-xs text-gray-600">{description}</p>
    </div>
  );
}

function RejectApplicationModal({
  application,
  reason,
  setReason,
  submitting,
  onClose,
  onConfirm,
}) {
  if (!application) return null;

  const applicant = getApplicant(application);
  const name =
    application.displayName ||
    applicant.displayName ||
    application.username ||
    applicant.email ||
    "this applicant";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-title"
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#19151e] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-red-400">
              Application decision
            </p>

            <h2 id="reject-title" className="mt-2 text-xl font-bold">
              Reject creator application
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close rejection dialog"
            className="rounded-lg px-3 py-1 text-xl text-gray-400 hover:bg-white/5 hover:text-white"
          >
            ×
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-gray-400">
          You are rejecting the application from{" "}
          <span className="font-semibold text-white">{name}</span>.
          The creator will be able to see your reason and submit a new
          application.
        </p>

        <label
          htmlFor="rejection-reason"
          className="mt-6 block text-sm font-medium text-gray-300"
        >
          Reason for rejection
        </label>

        <textarea
          id="rejection-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={5}
          maxLength={500}
          placeholder="Explain why this application is being rejected and what the applicant should improve..."
          className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#100d13] p-4 text-sm text-white outline-none placeholder:text-gray-600 focus:border-red-400"
        />

        <div className="mt-2 flex justify-between text-xs text-gray-600">
          <span>A rejection reason is required.</span>
          <span>{reason.length}/500</span>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-gray-300 hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting || reason.trim().length < 3}
            className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Rejecting..." : "Confirm rejection"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ user, onLogout, isLoading }) {
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });

  const [loadingApplications, setLoadingApplications] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectingApplication, setRejectingApplication] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadApplications = useCallback(
    async (requestedPage = 1, requestedFilter = filter) => {
      setLoadingApplications(true);
      setError("");

      try {
        const response = await getCreatorApplications({
          page: requestedPage,
          limit: PAGE_SIZE,
          status: requestedFilter,
        });

        setApplications(getApplications(response));
        setPagination(getPagination(response, requestedPage));
        setPage(requestedPage);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Unable to load creator applications.",
        );
      } finally {
        setLoadingApplications(false);
      }
    },
    [filter],
  );

    useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
        if (!cancelled) {
        loadApplications(1, filter);
        }
    });

    return () => {
        cancelled = true;
    };
    }, [filter, loadApplications]);

  async function handleApproval(application) {
    const applicant = getApplicant(application);
    const name =
      application.displayName ||
      applicant.displayName ||
      application.username ||
      "this creator";

    const confirmed = window.confirm(
      `Approve the creator application for ${name}?`,
    );

    if (!confirmed) return;

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      await reviewCreatorApplication(application._id || application.id, {
        status: "APPROVED",
      });

      setNotice("Creator application approved successfully.");
      await loadApplications(page, filter);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to approve this application.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function openRejection(application) {
    setRejectingApplication(application);
    setRejectionReason("");
    setError("");
    setNotice("");
  }

  async function handleRejection() {
    const reason = rejectionReason.trim();

    if (!reason) {
      setError("Please provide a reason for rejecting this application.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      await reviewCreatorApplication(
        rejectingApplication._id || rejectingApplication.id,
        {
          status: "REJECTED",
          rejectionReason: reason,
        },
      );

      setRejectingApplication(null);
      setRejectionReason("");
      setNotice("Creator application rejected successfully.");
      await loadApplications(page, filter);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to reject this application.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#100d13] text-white">
      <header className="border-b border-white/10 bg-[#19151e]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
          <div>
            <h1 className="text-xl font-bold">
              Premium <span className="text-[#c0445c]">Chat</span>
              <span className="ml-2 text-sm font-medium text-gray-500">
                Admin
              </span>
            </h1>

            <p className="mt-1 text-xs text-gray-500">
              Platform administration
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">
                {user?.displayName || "Administrator"}
              </p>
              <p className="text-xs text-gray-500">Administrator account</p>
            </div>

            <button
              type="button"
              onClick={onLogout}
              disabled={isLoading}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
            >
              {isLoading ? "Please wait..." : "Log out"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d66b82]">
            Administration
          </p>

          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            Platform overview
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">
            Manage creator applications and oversee the Premium Chat
            platform from one place.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStat
            label="Applications in this view"
            value={pagination.total}
            description={`${filter.toLowerCase()} applications`}
          />

          <AdminStat
            label="Current page"
            value={`${page} / ${pagination.pages}`}
            description="Application queue pagination"
          />

          <AdminStat
            label="Administrator"
            value="Active"
            description={user?.email || "Signed-in admin"}
          />

          <AdminStat
            label="Review queue"
            value={filter}
            description="Selected application status"
          />
        </section>

        <section className="mt-10">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#c0445c]">
                Creator management
              </p>

              <h3 className="mt-2 text-2xl font-bold">
                Creator applications
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Review applications and make approval decisions.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadApplications(page, filter)}
              disabled={loadingApplications}
              className="rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
            >
              {loadingApplications ? "Refreshing..." : "Refresh queue"}
            </button>
          </div>

          <div className="mt-7 flex flex-wrap gap-2 border-b border-white/10 pb-4">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`rounded-lg px-5 py-3 text-sm font-semibold transition ${
                  filter === item.value
                    ? "bg-[#c0445c] text-white"
                    : "border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {notice && (
            <div className="mt-5 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">
              {notice}
            </div>
          )}

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#19151e]">
            {loadingApplications ? (
              <div className="p-12 text-center text-sm text-gray-500">
                Loading creator applications...
              </div>
            ) : applications.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-3xl text-gray-600">✦</div>

                <h4 className="mt-4 font-semibold">
                  No {filter.toLowerCase()} applications
                </h4>

                <p className="mt-2 text-sm text-gray-500">
                  Applications with this status will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left">
                  <thead className="border-b border-white/10 bg-white/[0.03]">
                    <tr className="text-xs uppercase tracking-wider text-gray-500">
                      <th className="px-6 py-4 font-semibold">Applicant</th>
                      <th className="px-6 py-4 font-semibold">Username</th>
                      <th className="px-6 py-4 font-semibold">Country</th>
                      <th className="px-6 py-4 font-semibold">Submitted</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      {filter === "PENDING" && (
                        <th className="px-6 py-4 font-semibold">Actions</th>
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/5">
                    {applications.map((application) => {
                      const applicant = getApplicant(application);
                      const name =
                        application.displayName ||
                        applicant.displayName ||
                        "Unnamed applicant";

                      const email = applicant.email || "No email available";
                      const username =
                        application.username ||
                        applicant.username ||
                        "—";

                      return (
                        <tr
                          key={application._id || application.id}
                          className="align-top transition hover:bg-white/[0.02]"
                        >
                          <td className="px-6 py-5">
                            <p className="font-semibold text-white">{name}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              {email}
                            </p>
                          </td>

                          <td className="px-6 py-5 text-sm text-gray-300">
                            @{username}
                          </td>

                          <td className="px-6 py-5 text-sm text-gray-400">
                            {application.country || "—"}
                          </td>

                          <td className="px-6 py-5 text-sm text-gray-400">
                            {formatDate(
                              application.submittedAt ||
                                application.createdAt,
                            )}
                          </td>

                          <td className="px-6 py-5">
                            <StatusBadge status={application.applicationStatus || application.status} />
                          </td>

                          {filter === "PENDING" && (
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={() => handleApproval(application)}
                                  className="rounded-lg bg-green-600/15 px-3 py-2 text-xs font-semibold text-green-300 transition hover:bg-green-600/25 disabled:opacity-50"
                                >
                                  Approve
                                </button>

                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={() => openRejection(application)}
                                  className="rounded-lg bg-red-600/15 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-600/25 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!loadingApplications && pagination.pages > 1 && (
            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-sm text-gray-500">
                Page {page} of {pagination.pages}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => loadApplications(page - 1, filter)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Previous
                </button>

                <button
                  type="button"
                  disabled={page >= pagination.pages}
                  onClick={() => loadApplications(page + 1, filter)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="mt-12">
          <h3 className="text-xl font-bold">More administration modules</h3>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "User management",
                description: "Search users and manage account status.",
                icon: "👥",
              },
              {
                title: "Content moderation",
                description: "Review creator videos, photos and reports.",
                icon: "🎬",
              },
              {
                title: "Payments and transactions",
                description: "Inspect M-Pesa payments and purchase records.",
                icon: "💳",
              },
              {
                title: "Subscriptions",
                description: "Monitor subscriptions and renewals.",
                icon: "🔁",
              },
              {
                title: "Reports and disputes",
                description: "Handle user reports and payment disputes.",
                icon: "🛡️",
              },
              {
                title: "Platform analytics",
                description: "Monitor revenue, users and platform growth.",
                icon: "📊",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-white/10 bg-[#19151e] p-5"
              >
                <span className="text-2xl">{item.icon}</span>
                <h4 className="mt-4 font-semibold">{item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {item.description}
                </p>
                <span className="mt-4 inline-block text-xs font-semibold text-gray-600">
                  Planned module
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <RejectApplicationModal
        application={rejectingApplication}
        reason={rejectionReason}
        setReason={setRejectionReason}
        submitting={submitting}
        onClose={() => {
          if (!submitting) setRejectingApplication(null);
        }}
        onConfirm={handleRejection}
      />
    </main>
  );
}

function AccountDashboard({ user, onLogout, isLoading }) {
  return (
    <main className="min-h-screen bg-[#100d13] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <h1 className="text-2xl font-bold">
            Premium <span className="text-fuchsia-400">Chat.</span>
          </h1>

          <button
            type="button"
            onClick={onLogout}
            disabled={isLoading}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/10 disabled:opacity-50"
          >
            {isLoading ? "Please wait..." : "Log out"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-fuchsia-400">
          Your account
        </p>

        <h2 className="mt-4 text-4xl font-bold">
          Welcome, {user?.displayName}.
        </h2>

        <p className="mt-4 max-w-xl text-gray-400">
          Your Premium Chat account is active. We're building your creator
          experience, video discovery and private conversations.
        </p>

        <section className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-gray-500">Account role</p>
            <p className="mt-3 text-xl font-semibold">{user?.role}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-gray-500">Account status</p>
            <p className="mt-3 text-xl font-semibold text-green-400">
              {user?.status}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-gray-500">Email verification</p>
            <p className="mt-3 text-xl font-semibold">
              {user?.emailVerified ? "Verified" : "Not verified"}
            </p>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-7">
          <h3 className="text-lg font-semibold">
            Your Premium Chat journey starts here.
          </h3>

          <p className="mt-2 text-sm leading-6 text-gray-400">
            The next modules will introduce creator profiles, video discovery,
            subscriptions, paid content and private messaging.
          </p>
        </section>
      </div>
    </main>
  );
}

function DashboardPage() {
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isLoading = useAuthStore((state) => state.isLoading);

  async function handleLogout() {
    const result = await logout();

    if (result.success) {
      navigate("/login", { replace: true });
    }
  }

  if (user?.role === "ADMIN") {
    return (
      <AdminDashboard
        user={user}
        onLogout={handleLogout}
        isLoading={isLoading}
      />
    );
  }

  return (
    <AccountDashboard
      user={user}
      onLogout={handleLogout}
      isLoading={isLoading}
    />
  );
}

export default DashboardPage;
