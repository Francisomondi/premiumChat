
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  cancelMySubscription,
  getMySubscriptions,
  getMySubscriptionPayments,
} from "../../../api/services/subscriptionService";

const PAGE_SIZE = 12;

const FILTERS = [
  { label: "All subscriptions", value: "" },
  { label: "Active", value: "ACTIVE" },
  { label: "Pending", value: "PENDING" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Payment failed", value: "PAYMENT_FAILED" },
];

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatMoney(amount, currency = "KES") {
  const value = Number(amount);

  if (!Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function getErrorMessage(error, fallback) {
  return (
    error.response?.data?.message ||
    error.message ||
    fallback
  );
}

function getStatusStyle(status) {
  const styles = {
    ACTIVE: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    PENDING: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    EXPIRED: "border-gray-500/25 bg-gray-500/10 text-gray-300",
    CANCELLED: "border-red-500/25 bg-red-500/10 text-red-300",
    PAYMENT_FAILED: "border-red-500/25 bg-red-500/10 text-red-300",
  };

  return styles[status] || "border-white/10 bg-white/5 text-gray-300";
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getStatusStyle(status)}`}
    >
      <span className="mr-2 h-1.5 w-1.5 rounded-full bg-current" />
      {(status || "UNKNOWN").replaceAll("_", " ")}
    </span>
  );
}

function SummaryCard({ label, value, description, accent = "text-white" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#19151e] p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-3 text-3xl font-bold ${accent}`}>{value}</p>
      <p className="mt-2 text-xs text-gray-600">{description}</p>
    </div>
  );
}

function PaymentHistory({ payments, loading, error }) {
  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        Loading payment history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!payments.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
        <p className="text-sm font-medium text-gray-300">
          No payment records yet
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Payments associated with this subscription will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 sm:grid">
        <span>Reference</span>
        <span>Amount</span>
        <span>Status</span>
        <span>Date</span>
      </div>

      <div className="divide-y divide-white/5">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="grid gap-3 px-4 py-4 sm:grid-cols-[1.5fr_1fr_1fr_1fr] sm:items-center sm:gap-4"
          >
            <div className="min-w-0">
              <p className="text-xs text-gray-500 sm:hidden">Reference</p>
              <p className="truncate text-sm font-medium text-white">
                {payment.paymentReference}
              </p>
              <p className="mt-1 text-xs text-gray-600">
                {payment.purpose.replaceAll("_", " ")}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 sm:hidden">Amount</p>
              <p className="text-sm font-semibold text-white">
                {formatMoney(payment.amountKes, payment.currency)}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 sm:hidden">Status</p>
              <StatusBadge status={payment.status} />
            </div>

            <div>
              <p className="text-xs text-gray-500 sm:hidden">Date</p>
              <p className="text-sm text-gray-400">
                {formatDate(payment.createdAt)}
              </p>
              {payment.verifiedAt && (
                <p className="mt-1 text-xs text-emerald-400">
                  Verified {formatDate(payment.verifiedAt)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubscriptionDetails({
  subscription,
  onClose,
  onCancel,
  cancelling,
}) {
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [paymentError, setPaymentError] = useState("");

  const subscriptionId = subscription.id;

  useEffect(() => {
    let cancelled = false;

    async function loadPayments() {
      setLoadingPayments(true);
      setPaymentError("");

      try {
        const response = await getMySubscriptionPayments(
          subscriptionId,
          { page: 1, limit: 20 },
        );

        if (!cancelled) {
          setPayments(response.payments || []);
        }
      } catch (error) {
        if (!cancelled) {
          setPaymentError(
            getErrorMessage(
              error,
              "Unable to load payment history.",
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPayments(false);
        }
      }
    }

    loadPayments();

    return () => {
      cancelled = true;
    };
  }, [subscriptionId]);

  const creator = subscription.creator || {};
  const canCancel = subscription.status === "PENDING";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscription-details-title"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#17121c] p-5 shadow-2xl sm:rounded-3xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d66b82]">
              Subscription details
            </p>
            <h2
              id="subscription-details-title"
              className="mt-2 text-2xl font-bold text-white"
            >
              {creator.displayName || "Creator subscription"}
            </h2>
            {creator.username && (
              <Link
                to={`/creators/${creator.username}`}
                onClick={onClose}
                className="mt-1 inline-block text-sm text-[#e58ba0] hover:text-white"
              >
                @{creator.username}
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close subscription details"
            className="rounded-xl border border-white/10 px-3 py-2 text-gray-400 transition hover:bg-white/5 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-gray-500">Subscription status</p>
            <div className="mt-3">
              <StatusBadge status={subscription.status} />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-gray-500">Subscription price</p>
            <p className="mt-2 text-xl font-bold text-white">
              {formatMoney(subscription.amountKes, subscription.currency)}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-gray-500">Started on</p>
            <p className="mt-2 text-sm font-semibold text-white">
              {formatDate(subscription.startedAt)}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-gray-500">Access expires</p>
            <p className="mt-2 text-sm font-semibold text-white">
              {formatDate(subscription.expiresAt)}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">
              Payment history
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              A record of payments linked to this subscription.
            </p>
          </div>

          <PaymentHistory
            payments={payments}
            loading={loadingPayments}
            error={paymentError}
          />
        </div>

        {canCancel && (
          <div className="mt-7 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-sm font-semibold text-amber-200">
              Cancel pending reservation
            </p>
            <p className="mt-1 text-xs leading-5 text-gray-400">
              Cancellation is only possible if there is no unresolved
              payment that could still complete.
            </p>

            <button
              type="button"
              onClick={() => onCancel(subscription)}
              disabled={cancelling}
              className="mt-4 rounded-lg border border-red-500/30 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              {cancelling ? "Cancelling..." : "Cancel reservation"}
            </button>
          </div>
        )}

        {subscription.status === "ACTIVE" && (
          <p className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-6 text-emerald-200">
            Your subscription is prepaid. It does not automatically
            renew, and your access remains available until the expiry
            date shown above.
          </p>
        )}

        <div className="mt-7 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-gray-300 transition hover:bg-white/5"
          >
            Close details
          </button>
        </div>
      </section>
    </div>
  );
}

function SubscriptionCard({ subscription, onDetails }) {
  const creator = subscription.creator || {};
  const name = creator.displayName || "Creator";
  const username = creator.username;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-[#19151e] transition duration-300 hover:-translate-y-1 hover:border-[#c0445c]/50 hover:shadow-xl hover:shadow-black/20">
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-[#542033] via-[#281725] to-[#17121c]">
        <div className="absolute -right-8 -top-12 h-40 w-40 rounded-full border border-white/10" />
        <div className="absolute -right-1 -top-6 h-28 w-28 rounded-full border border-white/10" />
        <div className="absolute -bottom-12 left-16 h-32 w-32 rounded-full bg-[#c0445c]/20 blur-2xl" />

        <div className="absolute left-5 top-5">
          <StatusBadge status={subscription.status} />
        </div>

        <div className="absolute bottom-4 right-5 text-xs font-medium text-white/40">
          PREMIUM CHAT
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="-mt-9 flex items-end justify-between gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-[#19151e] bg-gradient-to-br from-[#c0445c] to-[#6e263c] text-lg font-bold text-white shadow-lg">
            {initials || "PC"}
          </div>

          <p className="pb-2 text-lg font-bold text-white">
            {formatMoney(subscription.amountKes, subscription.currency)}
          </p>
        </div>

        <div className="mt-3">
          <h3 className="text-lg font-bold text-white">{name}</h3>

          {username ? (
            <Link
              to={`/creators/${username}`}
              className="mt-1 inline-block text-sm text-[#df8298] hover:text-white"
            >
              @{username}
            </Link>
          ) : (
            <p className="mt-1 text-sm text-gray-500">
              Creator profile unavailable
            </p>
          )}

          {creator.country && (
            <p className="mt-2 text-xs text-gray-500">
              {creator.country}
            </p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-y border-white/10 py-4">
          <div>
            <p className="text-xs text-gray-500">Started</p>
            <p className="mt-1 text-sm font-medium text-gray-200">
              {subscription.startedAt
                ? formatDate(subscription.startedAt)
                : "Not started"}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">Expires</p>
            <p className="mt-1 text-sm font-medium text-gray-200">
              {formatDate(subscription.expiresAt)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDetails(subscription)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#c0445c] focus:outline-none focus:ring-2 focus:ring-[#c0445c]/60"
        >
          View details
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  );
}

export default function MySubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const loadSubscriptions = useCallback(
    async (requestedPage = 1, requestedFilter = filter) => {
      setLoading(true);
      setError("");

      try {
        const response = await getMySubscriptions({
          page: requestedPage,
          limit: PAGE_SIZE,
          status: requestedFilter || undefined,
        });

        setSubscriptions(response.subscriptions || []);
        setPagination(
          response.pagination || {
            page: requestedPage,
            pages: 1,
            total: 0,
          },
        );
        setPage(requestedPage);
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            "Unable to load your subscriptions.",
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );

    useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
        if (!cancelled) {
        loadSubscriptions(1, filter);
        }
    });

    return () => {
        cancelled = true;
    };
    }, [filter, loadSubscriptions]);

  async function handleCancel(subscription) {
    const confirmed = window.confirm(
      "Cancel this pending subscription reservation? If an M-Pesa payment is still unresolved, the server will prevent cancellation.",
    );

    if (!confirmed) return;

    setCancelling(true);
    setError("");
    setNotice("");

    try {
      const response = await cancelMySubscription(subscription.id);
      setNotice(
        response.message || "Subscription reservation cancelled.",
      );
      setSelectedSubscription(null);
      await loadSubscriptions(page, filter);
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Unable to cancel this reservation.",
        ),
      );
    } finally {
      setCancelling(false);
    }
  }

  const activeCount = subscriptions.filter(
    (item) => item.status === "ACTIVE",
  ).length;

  const pendingCount = subscriptions.filter(
    (item) => item.status === "PENDING",
  ).length;

  const expiredCount = subscriptions.filter(
    (item) => item.status === "EXPIRED",
  ).length;

  return (
    <main className="min-h-screen bg-[#100d13] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#15111a]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/dashboard" className="text-xl font-bold tracking-tight">
            Premium <span className="text-[#d45b75]">Chat.</span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              to="/explore"
              className="rounded-lg px-3 py-2 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
            >
              Explore creators
            </Link>
            <Link
              to="/dashboard"
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:bg-white/5"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-9 sm:py-12">
        <section className="relative overflow-hidden rounded-3xl border border-[#c0445c]/20 bg-gradient-to-br from-[#351a2b] via-[#211724] to-[#17121c] p-6 sm:p-9">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-2 -top-10 h-52 w-52 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-[#c0445c]/15 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#e58ba0]">
                Your memberships
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
                My subscriptions
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-gray-300 sm:text-base">
                Keep track of the creators you support, your membership
                periods and every payment connected to your subscriptions.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/explore"
                  className="rounded-xl bg-[#c0445c] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#c0445c]/20 transition hover:bg-[#d1536d]"
                >
                  Discover creators
                  <span className="ml-2" aria-hidden="true">→</span>
                </Link>
                <button
                  type="button"
                  onClick={() => loadSubscriptions(page, filter)}
                  disabled={loading}
                  className="rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 disabled:opacity-50"
                >
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>

            <div className="relative min-w-40 rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-widest text-gray-400">
                Total memberships
              </p>
              <p className="mt-2 text-4xl font-black text-white">
                {pagination.total}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Across your account
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Active on this page"
            value={activeCount}
            description="Memberships currently active"
            accent="text-emerald-300"
          />
          <SummaryCard
            label="Pending on this page"
            value={pendingCount}
            description="Reservations awaiting payment"
            accent="text-amber-300"
          />
          <SummaryCard
            label="Expired on this page"
            value={expiredCount}
            description="Membership periods that have ended"
            accent="text-gray-300"
          />
        </section>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300"
          >
            {notice}
          </div>
        )}

        <section className="mt-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d66b82]">
                Membership library
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                Your creator memberships
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Select a membership to inspect its details and payment history.
              </p>
            </div>

            <p className="text-sm text-gray-500">
              {pagination.total} result{pagination.total === 1 ? "" : "s"}
            </p>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto pb-3">
            {FILTERS.map((item) => (
              <button
                key={item.value || "ALL"}
                type="button"
                onClick={() => {
                  setNotice("");
                  setFilter(item.value);
                }}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  filter === item.value
                    ? "bg-[#c0445c] text-white shadow-lg shadow-[#c0445c]/15"
                    : "border border-white/10 bg-white/[0.03] text-gray-400 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-80 animate-pulse rounded-2xl border border-white/10 bg-[#19151e]"
                />
              ))}
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#c0445c]/10 text-3xl text-[#e58ba0]">
                ✦
              </div>

              <h3 className="mt-5 text-xl font-bold text-white">
                {filter
                  ? `No ${filter.toLowerCase().replaceAll("_", " ")} subscriptions`
                  : "Your creator journey starts here"}
              </h3>

              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-500">
                {filter
                  ? "There are no subscriptions matching this filter. Try another status."
                  : "Discover creators, explore their videos and subscribe to the ones whose content you enjoy."}
              </p>

              <Link
                to="/explore"
                className="mt-6 inline-flex rounded-xl bg-[#c0445c] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#d1536d]"
              >
                Explore creators
              </Link>
            </div>
          ) : (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {subscriptions.map((subscription) => (
                <SubscriptionCard
                  key={subscription.id}
                  subscription={subscription}
                  onDetails={setSelectedSubscription}
                />
              ))}
            </div>
          )}

          {!loading && pagination.pages > 1 && (
            <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
              <p className="text-sm text-gray-500">
                Page {page} of {pagination.pages}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => loadSubscriptions(page - 1, filter)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Previous
                </button>

                <button
                  type="button"
                  disabled={page >= pagination.pages}
                  onClick={() => loadSubscriptions(page + 1, filter)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>

        <footer className="mt-14 border-t border-white/10 py-6 text-center text-xs leading-6 text-gray-600">
          Subscription access is based on verified payments and the recorded
          membership expiry date. Pending payments may require reconciliation.
        </footer>
      </div>

      {selectedSubscription && (
        <SubscriptionDetails
          key={selectedSubscription.id}
          subscription={selectedSubscription}
          onClose={() => setSelectedSubscription(null)}
          onCancel={handleCancel}
          cancelling={cancelling}
        />
      )}
    </main>
  );
}
