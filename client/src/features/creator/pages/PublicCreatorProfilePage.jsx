
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getPublicCreatorProfile } from "../../../api/services/creatorService";
import {
  createSubscriptionReservation,
  initiateSubscriptionMpesaPayment,
  getPaymentStatus,
} from "../../../api/services/subscriptionService";
import { getPublicCreatorVideos } from "../../../api/services/publicVideoService";
import VideoPlayerModal from "../../explore/components/VideoPlayerModal";

const PAGE_SIZE = 12;

function formatKes(amount) {
  return Number(amount || 0).toLocaleString("en-KE");
}

function getPaymentStatusPresentation(status, accessGranted) {
  if (accessGranted) {
    return {
      title: "Subscription active",
      description: "Your payment is confirmed and your subscription is ready.",
      icon: "✓",
      color: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    };
  }

  const states = {
    PENDING: {
      title: "Waiting for payment",
      description: "Your payment request is being prepared.",
      icon: "◷",
      color: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    },
    INITIATING: {
      title: "Connecting to M-Pesa",
      description: "Your payment request is being sent.",
      icon: "◷",
      color: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    },
    PROCESSING: {
      title: "Awaiting M-Pesa confirmation",
      description: "Check your phone and complete the payment prompt.",
      icon: "◷",
      color: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    },
    UNKNOWN: {
      title: "Payment being reconciled",
      description: "The payment outcome is uncertain. Do not pay again.",
      icon: "!",
      color: "border-orange-500/20 bg-orange-500/10 text-orange-200",
    },
    SUCCEEDED: {
      title: "Payment verified",
      description: "We are waiting for your subscription to be activated.",
      icon: "✓",
      color: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
    },
    FAILED: {
      title: "Payment unsuccessful",
      description: "M-Pesa did not complete this payment.",
      icon: "×",
      color: "border-red-500/20 bg-red-500/10 text-red-300",
    },
    CANCELLED: {
      title: "Payment cancelled",
      description: "This payment request was cancelled.",
      icon: "×",
      color: "border-red-500/20 bg-red-500/10 text-red-300",
    },
    REQUIRES_RECONCILIATION: {
      title: "Payment needs attention",
      description: "This transaction requires reconciliation. Do not submit another payment.",
      icon: "!",
      color: "border-orange-500/20 bg-orange-500/10 text-orange-200",
    },
  };

  return states[status] || {
    title: "Checking payment",
    description: "We are checking the latest payment information.",
    icon: "◷",
    color: "border-white/10 bg-white/5 text-gray-300",
  };
}

function VideoCard({ video, onPlay, onSubscribe }) {
  const isFree = video.accessPolicy === "FREE";
  const isSubscribersOnly = video.accessPolicy === "SUBSCRIBERS_ONLY";

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#19151e] transition duration-300 hover:-translate-y-1 hover:border-[#c0445c]/50 hover:shadow-xl hover:shadow-black/20">
      <button
        type="button"
        onClick={() => onPlay(video)}
        aria-label={`Watch ${video.title}`}
        className="relative block aspect-video w-full overflow-hidden bg-gradient-to-br from-[#49243b] via-[#241725] to-[#100d13] text-left"
      >
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-5xl text-white/20">▶</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />

        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-black/55 text-xl text-white shadow-lg backdrop-blur-md transition duration-300 group-hover:scale-110 group-hover:bg-[#c0445c]">
            {isFree ? "▶" : "🔒"}
          </span>
        </div>

        <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/65 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
          {isFree ? "Free video" : isSubscribersOnly ? "Subscribers" : "Pay per view"}
        </span>

        {video.durationSeconds > 0 && (
          <span className="absolute bottom-3 right-3 rounded-md bg-black/75 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            {Math.floor(video.durationSeconds / 60)}:
            {String(Math.floor(video.durationSeconds % 60)).padStart(2, "0")}
          </span>
        )}
      </button>

      <div className="p-4">
        <h3 className="line-clamp-2 font-semibold leading-6 text-white">
          {video.title}
        </h3>

        {video.description && (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">
            {video.description}
          </p>
        )}

        {!isFree && (
          <div className="mt-4 border-t border-white/[0.06] pt-3">
            <p className="text-xs text-gray-500">
              {isSubscribersOnly
                ? "Exclusive content for subscribers."
                : "Purchase access to watch this video."}
            </p>

            {isSubscribersOnly && (
              <button
                type="button"
                onClick={onSubscribe}
                className="mt-3 text-xs font-bold text-[#e0778c] transition hover:text-white"
              >
                Unlock with subscription →
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function SubscriptionDialog({
  price,
  loading,
  error,
  paymentMessage,
  paymentId,
  paymentStatus,
  phoneNumber,
  onPhoneNumberChange,
  onSubmit,
  onClose,
}) {
  const status = paymentStatus?.payment?.status;
  const accessGranted = paymentStatus?.accessGranted === true;
  const hasPaymentRequest = Boolean(paymentId);
  const presentation = getPaymentStatusPresentation(status, accessGranted);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 px-4 py-8 backdrop-blur-md"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscription-dialog-title"
        className="my-auto w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#19151e] shadow-2xl shadow-black/50"
      >
        <div className="relative overflow-hidden border-b border-white/[0.08] px-6 pb-6 pt-7">
          <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-[#c0445c]/15 blur-3xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#c0445c]/25 bg-[#c0445c]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#e0778c]">
                <span>✦</span>
                Creator membership
              </div>

              <h2
                id="subscription-dialog-title"
                className="mt-4 text-2xl font-bold tracking-tight text-white"
              >
                Unlock the experience
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-400">
                Get access to this creator's exclusive subscriber content.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              aria-label="Close subscription dialog"
              className="rounded-xl border border-white/10 px-3 py-2 text-xl text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              ×
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-[#c0445c]/20 bg-gradient-to-br from-[#3d1c31]/70 to-[#19151e] p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Monthly membership
              </p>
              <span className="rounded-full bg-[#c0445c]/15 px-2.5 py-1 text-[10px] font-bold text-[#e8a4b2]">
                MONTHLY
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-sm font-medium text-gray-400">KES</span>
              <span className="text-4xl font-extrabold tracking-tight text-white">
                {formatKes(price)}
              </span>
              <span className="text-sm text-gray-500">/ month</span>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
              <span className="text-[#e0778c]">✓</span>
              Access to subscribers-only videos
            </div>
          </div>

          {hasPaymentRequest ? (
            <div className={`rounded-2xl border p-4 ${presentation.color}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/15 text-lg font-bold">
                  {presentation.icon}
                </span>

                <div className="min-w-0">
                  <h3 className="font-semibold">
                    {presentation.title}
                  </h3>
                  <p className="mt-1 text-xs leading-5 opacity-80">
                    {presentation.description}
                  </p>
                </div>
              </div>

              {status !== "FAILED" &&
                status !== "CANCELLED" &&
                status !== "REQUIRES_RECONCILIATION" &&
                !accessGranted && (
                  <div className="mt-4 flex items-center gap-2 text-xs opacity-80">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                    Automatically checking payment status
                  </div>
                )}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="subscription-phone"
                  className="mb-2 block text-sm font-semibold text-gray-300"
                >
                  M-Pesa phone number
                </label>

                <input
                  id="subscription-phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  value={phoneNumber}
                  onChange={(event) => onPhoneNumberChange(event.target.value)}
                  placeholder="07XXXXXXXX"
                  className="w-full rounded-xl border border-white/10 bg-[#100d13] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-[#c0445c] focus:ring-2 focus:ring-[#c0445c]/15"
                />

                <p className="mt-2 text-xs leading-5 text-gray-500">
                  Enter the Safaricom number that should receive your payment prompt.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm leading-5 text-red-300"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !phoneNumber.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#c0445c] to-[#9e3049] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[#c0445c]/15 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Connecting to M-Pesa...
                  </>
                ) : (
                  <>
                    Pay with M-Pesa
                    <span>→</span>
                  </>
                )}
              </button>
            </form>
          )}

          {paymentMessage && (
            <div
              role="status"
              className="rounded-xl border border-white/[0.08] bg-black/20 p-3 text-xs leading-6 text-gray-300"
            >
              {paymentMessage}
            </div>
          )}

          {hasPaymentRequest && (
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <p className="text-xs leading-5 text-gray-400">
                {accessGranted
                  ? "Your membership is active. You can close this window and enjoy the exclusive videos."
                  : "Do not submit another payment request for this transaction. You can safely close this window while reconciliation continues."}
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 border-t border-white/[0.06] pt-4 text-[11px] text-gray-500">
            <span className="text-emerald-400">●</span>
            Secure payment processing
            <span className="text-gray-700">·</span>
            M-Pesa
          </div>

          <p className="text-center text-[11px] leading-5 text-gray-600">
            Access is granted only after payment verification and subscription activation.
          </p>
        </div>
      </section>
    </div>
  );
}

function PublicCreatorProfilePage() {
  const { username } = useParams();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [videos, setVideos] = useState([]);
  const [videoPage, setVideoPage] = useState(1);
  const [videoPages, setVideoPages] = useState(1);
  const [videoTotal, setVideoTotal] = useState(0);
  const [videosLoading, setVideosLoading] = useState(true);
  const [videosError, setVideosError] = useState("");

  const [selectedVideo, setSelectedVideo] = useState(null);

  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [reservation, setReservation] = useState(null);
  const [paymentId, setPaymentId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getPublicCreatorProfile(username);
      setProfile(response.profile || null);
    } catch (requestError) {
      setProfile(null);
      setError(
        requestError.response?.data?.message ||
          "We couldn't load this creator's profile.",
      );
    } finally {
      setLoading(false);
    }
  }, [username]);

  const loadVideos = useCallback(
    async (requestedPage = 1) => {
      setVideosLoading(true);
      setVideosError("");

      try {
        const response = await getPublicCreatorVideos(username, {
          page: requestedPage,
          limit: PAGE_SIZE,
        });

        setVideos(response.videos || []);
        setVideoPage(response.pagination?.page || requestedPage);
        setVideoPages(response.pagination?.totalPages || 1);
        setVideoTotal(response.pagination?.total || 0);
      } catch (requestError) {
        setVideos([]);
        setVideosError(
          requestError.response?.data?.message ||
            "We couldn't load this creator's videos.",
        );
      } finally {
        setVideosLoading(false);
      }
    },
    [username],
  );

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (!cancelled) {
        loadProfile();
        loadVideos(1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadProfile, loadVideos]);

  // Poll payment status without ever dispatching another STK Push.
  useEffect(() => {
    if (!paymentId) {
      return undefined;
    }

    let cancelled = false;
    let timeoutId = null;
    let checking = false;

    const checkPaymentStatus = async () => {
      if (cancelled || checking) {
        return;
      }

      checking = true;
      let shouldContinue = true;

      try {
        const response = await getPaymentStatus(paymentId);

        if (cancelled) {
          return;
        }

        setPaymentStatus(response);

        const status = response.payment?.status;
        const accessGranted = response.accessGranted === true;

        if (accessGranted) {
          shouldContinue = false;

          setPaymentMessage(
            "Your subscription is active. You can now watch this creator's subscribers-only videos.",
          );

          setReservation((current) =>
            current ? { ...current, status: "ACTIVE" } : current,
          );

          loadVideos(videoPage);
        } else if (status === "REQUIRES_RECONCILIATION") {
          shouldContinue = false;
          setPaymentMessage(
            "This transaction requires manual reconciliation. Do not submit another payment.",
          );
        } else if (status === "FAILED" || status === "CANCELLED") {
          shouldContinue = false;
          setPaymentMessage(
            response.payment?.message ||
              "The payment was not completed. This transaction cannot be retried automatically.",
          );
        } else if (status === "SUCCEEDED") {
          setPaymentMessage(
            "Payment verified successfully. We are waiting for the subscription to be activated. Please keep this page open.",
          );
        } else if (status === "UNKNOWN") {
          setPaymentMessage(
            "The payment outcome is uncertain and is being reconciled. Do not initiate another payment.",
          );
        } else {
          setPaymentMessage(
            "Waiting for M-Pesa confirmation. Check your phone and complete the payment prompt if it is still pending.",
          );
        }
      } catch {
        if (!cancelled) {
          setPaymentMessage(
            "We couldn't refresh your payment status. We'll automatically try again. Do not initiate another payment.",
          );
        }
      } finally {
        checking = false;

        if (!cancelled && shouldContinue) {
          timeoutId = setTimeout(checkPaymentStatus, 5000);
        }
      }
    };

    checkPaymentStatus();

    return () => {
      cancelled = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [paymentId, loadVideos, videoPage]);

  const openSubscriptionDialog = () => {
    setSubscriptionError("");
    setPaymentMessage("");
    setSubscriptionDialogOpen(true);
  };

  const handleSubscriptionPayment = async (event) => {
    event.preventDefault();

    if (subscriptionLoading || paymentId) {
      return;
    }

    const creatorProfileId = profile?.id || profile?._id;

    if (!creatorProfileId) {
      setSubscriptionError(
        "The creator profile ID is missing. Please refresh the page.",
      );
      return;
    }

    setSubscriptionLoading(true);
    setSubscriptionError("");
    setPaymentMessage("");

    try {
      let currentReservation = reservation;

      if (!currentReservation) {
        const reservationResponse = await createSubscriptionReservation({
          creatorProfileId,
          clientRequestId: crypto.randomUUID(),
        });

        currentReservation = reservationResponse.reservation;

        if (!currentReservation?.id) {
          throw new Error(
            "The subscription reservation response was incomplete.",
          );
        }

        setReservation(currentReservation);
      }

      if (currentReservation.status === "ACTIVE") {
        setPaymentMessage(
          "This subscription is already active. Try opening a subscribers-only video.",
        );
        return;
      }

      const paymentResponse = await initiateSubscriptionMpesaPayment({
        subscriptionId: currentReservation.id,
        phoneNumber: phoneNumber.trim(),
      });

      if (paymentResponse.paymentId) {
        setPaymentId(paymentResponse.paymentId);
      }

      if (
        paymentResponse.initiationStatus === "ACCEPTED" ||
        paymentResponse.status === "PROCESSING"
      ) {
        setPaymentMessage(
          paymentResponse.customerMessage ||
            "M-Pesa has received your payment request. Check your phone and enter your M-Pesa PIN to complete the transaction.",
        );
      } else if (
        paymentResponse.initiationStatus === "UNKNOWN" ||
        paymentResponse.status === "UNKNOWN" ||
        paymentResponse.status === "REQUIRES_RECONCILIATION"
      ) {
        setPaymentMessage(
          "The payment outcome is uncertain. Do not submit another payment request. The transaction requires reconciliation.",
        );
      } else if (
        paymentResponse.status === "SUCCEEDED" ||
        paymentResponse.paymentVerified === true
      ) {
        setPaymentMessage(
          "Payment verification succeeded. We are waiting for subscription activation.",
        );
      } else if (!paymentResponse.paymentId) {
        setPaymentMessage(
          paymentResponse.message ||
            "The payment response did not include a transaction ID. Please contact support before attempting another payment.",
        );
      } else {
        setPaymentMessage(
          paymentResponse.message ||
            "Your payment request has been received. We are checking its status.",
        );
      }
    } catch (requestError) {
      setSubscriptionError(
        requestError.response?.data?.message ||
          requestError.message ||
          "We couldn't initiate the subscription payment.",
      );
    } finally {
      setSubscriptionLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#100d13] px-5 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-[#c0445c]" />
          <p className="mt-5 text-sm text-gray-400">
            Preparing your creator experience...
          </p>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#100d13] px-5 text-white">
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#19151e] p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#c0445c]/10 text-3xl text-[#e0778c]">
            ✦
          </div>

          <h1 className="mt-6 text-2xl font-bold">Creator not found</h1>

          <p className="mt-3 text-sm leading-6 text-gray-400">
            {error || "This creator profile is unavailable."}
          </p>

          <Link
            to="/explore"
            className="mt-7 inline-flex rounded-xl bg-[#c0445c] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#a9364d]"
          >
            Explore creators
          </Link>
        </div>
      </main>
    );
  }

  const displayName = profile.displayName || profile.username;
  const subscriptionsEnabled = profile.subscriptionsEnabled === true;
  const subscriptionPrice = profile.monthlySubscriptionPriceKes;

  return (
    <main className="min-h-screen bg-[#100d13] text-white">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#100d13]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/explore" className="group">
            <span className="text-xl font-extrabold tracking-tight">
              Premium <span className="text-[#c0445c]">Chat</span>
            </span>
          </Link>

          <Link
            to="/explore"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-gray-300 transition hover:border-[#c0445c]/40 hover:bg-white/5 hover:text-white"
          >
            <span>←</span>
            Explore creators
          </Link>
        </div>
      </header>

      <section className="relative isolate overflow-hidden border-b border-white/[0.08]">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_rgba(192,68,92,0.24),_transparent_55%)]" />
        <div className="absolute -left-32 top-20 -z-10 h-72 w-72 rounded-full bg-[#c0445c]/10 blur-3xl" />

        <div className="mx-auto max-w-7xl px-5 pb-14 pt-10 sm:pb-20 sm:pt-16">
          <div className="mb-8 flex items-center gap-2 text-xs text-gray-500">
            <Link to="/explore" className="transition hover:text-white">
              Explore
            </Link>
            <span>/</span>
            <span className="text-[#e0778c]">{profile.username}</span>
          </div>

          <div className="flex flex-col gap-9 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[2rem] border border-[#c0445c]/30 bg-gradient-to-br from-[#632b48] to-[#241725] text-5xl font-extrabold text-[#f0b3c0] shadow-2xl shadow-[#c0445c]/10 sm:h-36 sm:w-36">
                {displayName.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#c0445c]/20 bg-[#c0445c]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#e8a4b2]">
                  <span>✦</span>
                  Creator profile
                </div>

                <h1 className="mt-4 break-words text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                  {displayName}
                </h1>

                <p className="mt-3 text-sm font-medium text-gray-400">
                  @{profile.username}
                </p>

                {profile.country && (
                  <p className="mt-3 text-xs text-gray-500">
                    <span className="mr-2">⌖</span>
                    {profile.country}
                  </p>
                )}
              </div>
            </div>

            {subscriptionsEnabled && (
              <div className="w-full rounded-2xl border border-[#c0445c]/20 bg-[#19151e]/90 p-5 shadow-xl shadow-black/20 sm:max-w-sm sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Become a member
                </p>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-sm font-medium text-gray-500">KES</span>
                  <span className="text-4xl font-extrabold tracking-tight">
                    {formatKes(subscriptionPrice)}
                  </span>
                  <span className="text-xs text-gray-500">/ month</span>
                </div>

                <p className="mt-3 text-xs leading-5 text-gray-500">
                  Get access to exclusive videos and subscriber-only content.
                </p>

                <button
                  type="button"
                  onClick={openSubscriptionDialog}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#c0445c] to-[#9e3049] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#c0445c]/15 transition hover:-translate-y-0.5 hover:brightness-110"
                >
                  Subscribe now
                  <span>→</span>
                </button>

                <p className="mt-3 text-center text-[10px] text-gray-600">
                  Secure payments powered by M-Pesa
                </p>
              </div>
            )}
          </div>

          {profile.bio && (
            <div className="mt-10 max-w-3xl border-l-2 border-[#c0445c]/50 pl-5">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e0778c]">
                About this creator
              </h2>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-gray-300 sm:text-base">
                {profile.bio}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#e0778c]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c0445c]" />
              Video-first experience
            </div>

            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Creator videos
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Discover the latest content from {displayName}.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-gray-400">
              {videoTotal} {videoTotal === 1 ? "video" : "videos"}
            </span>

            <button
              type="button"
              onClick={() => loadVideos(videoPage)}
              disabled={videosLoading}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-gray-300 transition hover:border-[#c0445c]/40 hover:bg-white/5 disabled:opacity-50"
            >
              {videosLoading ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>
        </div>

        {videosError && (
          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
            <p className="text-sm text-red-300">{videosError}</p>
            <button
              type="button"
              onClick={() => loadVideos(videoPage)}
              className="mt-3 text-xs font-bold text-white underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        {videosLoading ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#19151e]"
              >
                <div className="aspect-video animate-pulse bg-white/[0.05]" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-white/[0.05]" />
                </div>
              </div>
            ))}
          </div>
        ) : videos.length > 0 ? (
          <>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onPlay={setSelectedVideo}
                  onSubscribe={openSubscriptionDialog}
                />
              ))}
            </div>

            {videoPages > 1 && (
              <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  disabled={videoPage <= 1 || videosLoading}
                  onClick={() => loadVideos(videoPage - 1)}
                  className="rounded-xl border border-white/10 px-5 py-3 text-xs font-semibold text-gray-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ← Previous
                </button>

                <span className="text-xs font-medium text-gray-500">
                  Page {videoPage} of {videoPages}
                </span>

                <button
                  type="button"
                  disabled={videoPage >= videoPages || videosLoading}
                  onClick={() => loadVideos(videoPage + 1)}
                  className="rounded-xl border border-white/10 px-5 py-3 text-xs font-semibold text-gray-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mt-8 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#19151e]">
            <div className="flex min-h-80 flex-col items-center justify-center bg-gradient-to-br from-[#3d1c31]/70 via-[#241725] to-[#100d13] px-6 py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] text-3xl text-[#e0778c]">
                ▶
              </div>

              <h3 className="mt-6 text-xl font-bold">
                Something exciting is coming
              </h3>

              <p className="mt-3 max-w-md text-sm leading-7 text-gray-500">
                {displayName}'s published videos will appear here when they are ready to share.
              </p>
            </div>
          </div>
        )}
      </section>

      <footer className="border-t border-white/[0.08] px-5 py-8 text-center">
        <p className="text-xs font-semibold text-gray-500">
          Premium <span className="text-[#c0445c]">Chat</span>
        </p>
        <p className="mt-2 text-[10px] text-gray-700">
          Discover. Connect. Experience.
        </p>
      </footer>

      {selectedVideo && (
        <VideoPlayerModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}

      {subscriptionDialogOpen && (
        <SubscriptionDialog
          price={subscriptionPrice}
          loading={subscriptionLoading}
          error={subscriptionError}
          paymentMessage={paymentMessage}
          paymentId={paymentId}
          paymentStatus={paymentStatus}
          phoneNumber={phoneNumber}
          onPhoneNumberChange={setPhoneNumber}
          onSubmit={handleSubscriptionPayment}
          onClose={() => setSubscriptionDialogOpen(false)}
        />
      )}
    </main>
  );
}

export default PublicCreatorProfilePage;
