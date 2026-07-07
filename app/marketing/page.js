'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Megaphone,
  CheckCircle,
  XCircle,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Loader2,
  Calendar,
  Clock,
  Eye,
  AlertCircle,
  RefreshCw,
  FileText,
  ImagePlus,
} from 'lucide-react';
import MarketingTabs from './tabs';

/* ── Pillar configuration ── */

const PILLAR_EMOJI = {
  product: '🛒',
  case: '🏠',
  promo: '🎉',
  story: '📖',
  educational: '📚',
};

const PILLAR_STYLES = {
  product: { bg: '#e3f1d8', text: '#2e7d32' },
  case: { bg: '#e7f3ff', text: '#1877f2' },
  promo: { bg: '#fff4d6', text: '#b26b00' },
  story: { bg: '#f0e7ff', text: '#7b3ff2' },
  educational: { bg: '#d4f4f0', text: '#0d7a6e' },
};

/* ── Status configuration ── */

const STATUS_CONFIG = {
  copy_done: { label: 'Pending Review', bg: '#fff4d6', text: '#b26b00', dot: '#b26b00' },
  copy_approved: { label: 'Approved', bg: '#e8f5e9', text: '#2e7d32', dot: '#2e7d32' },
  image_ready: { label: 'Image Ready', bg: '#e7f3ff', text: '#1877f2', dot: '#1877f2' },
  image_retry: { label: 'Image Retry', bg: '#fde2e1', text: '#d32f2f', dot: '#d32f2f' },
  approved: { label: 'Ready to Publish', bg: '#e3f1d8', text: '#1b5e20', dot: '#1b5e20' },
};

/* ── Sub-components ── */

function PillarBadge({ pillar }) {
  const emoji = PILLAR_EMOJI[pillar] || '📝';
  const style = PILLAR_STYLES[pillar] || { bg: '#f2f3f5', text: '#65676b' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {emoji} {pillar}
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: '#f2f3f5', text: '#65676b' };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: cfg.dot }}
      />
      {cfg.label}
    </span>
  );
}

/* ── Helpers ── */

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

/* ── Loading Skeleton ── */

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-lg p-5 animate-pulse"
          style={{ backgroundColor: '#ffffff', border: '1px solid #dadde1' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-32 rounded" style={{ backgroundColor: '#e4e6eb' }} />
            <div className="h-4 w-20 rounded" style={{ backgroundColor: '#e4e6eb' }} />
          </div>
          <div className="h-3 w-full rounded mb-2" style={{ backgroundColor: '#f0f2f5' }} />
          <div className="h-3 w-3/4 rounded" style={{ backgroundColor: '#f0f2f5' }} />
        </div>
      ))}
    </div>
  );
}

/* ── Error State ── */

function ErrorState({ message, onRetry }) {
  return (
    <div
      className="rounded-lg p-6 flex flex-col items-center text-center"
      style={{ backgroundColor: '#fde2e1', border: '1px solid #f5b1ae' }}
    >
      <AlertCircle size={28} style={{ color: '#c62828' }} />
      <p className="text-[13px] font-semibold mt-2" style={{ color: '#a01818' }}>
        Failed to load data
      </p>
      <p className="text-[12px] mt-1 mb-3" style={{ color: '#a01818' }}>
        {message}
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-1.5 rounded-md text-[13px] font-semibold flex items-center gap-1.5 transition-colors"
        style={{ backgroundColor: '#c62828', color: '#ffffff' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#a01818'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#c62828'; }}
      >
        <RefreshCw size={14} />
        Retry
      </button>
    </div>
  );
}

/* ── Empty State ── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center text-center py-12">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
        style={{ backgroundColor: '#e7f3ff' }}
      >
        <Calendar size={22} strokeWidth={1.75} style={{ color: '#1877f2' }} />
      </div>
      <p className="text-[14px]" style={{ color: '#65676b' }}>
        No posts found for this plan
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ════════════════════════════════════════════ */

export default function MarketingReviewPage() {
  const router = useRouter();

  /* ── First-visit brand onboarding gate ──
     If the brand kit exists but hasn't been onboarded, send them through
     /onboarding first. Only redirects on an explicit onboarded===false so it
     stays inert before the migration adds the column (undefined = no gate). */
  const [gateChecked, setGateChecked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/brand/kit')
      .then((r) => r.ok ? r.json() : null)
      .then((kit) => {
        if (cancelled) return;
        if (kit && kit.onboarded === false) { router.replace('/onboarding'); return; }
        setGateChecked(true);
      })
      .catch(() => { if (!cancelled) setGateChecked(true); });
    return () => { cancelled = true; };
  }, [router]);

  /* ── Plan state ── */
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState('');

  /* ── Posts state ── */
  const [posts, setPosts] = useState([]);
  const [planInfo, setPlanInfo] = useState(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState('');

  /* ── UI state ── */
  const [expandedCard, setExpandedCard] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [actionError, setActionError] = useState({});
  const [rejecting, setRejecting] = useState({});
  const [rejectNotes, setRejectNotes] = useState({});
  const [imageryLoading, setImageryLoading] = useState(false);
  const [imageryMessage, setImageryMessage] = useState('');
  const [imageryError, setImageryError] = useState('');

  /* ── Summary computed from posts ── */
  const summary = useMemo(() => {
    const total = posts.length;
    const pending = posts.filter((p) => p.status === 'copy_done').length;
    const approved = posts.filter((p) => p.status === 'copy_approved').length;
    const withImagery = posts.filter(
      (p) => p.image_url || p.image_status === 'stored' || p.image_status === 'composited'
    ).length;
    return { total, pending, approved, withImagery };
  }, [posts]);

  /* ── Fetch plans on mount ── */
  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError('');
    try {
      const res = await fetch('/api/marketing/plans');
      const data = await res.json();
      if (data.error) {
        setPlansError(data.error);
      } else {
        const planList = Array.isArray(data) ? data : [];
        setPlans(planList);

        // Auto-select most recent plan with pending items
        const withPending = planList.filter((p) => (p.counts?.pending || 0) > 0);
        if (withPending.length > 0) {
          setSelectedPlanId(withPending[0].id);
        } else if (planList.length > 0) {
          setSelectedPlanId(planList[0].id);
        }
      }
    } catch {
      setPlansError('Failed to load plans.');
    }
    setPlansLoading(false);
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  /* ── Fetch posts when plan changes ── */
  const fetchPosts = useCallback(async (planId) => {
    if (!planId) return;
    setPostsLoading(true);
    setPostsError('');
    try {
      const res = await fetch(`/api/marketing/plan/${planId}`);
      const data = await res.json();
      if (data.error) {
        setPostsError(data.error);
      } else {
        setPlanInfo(data.plan || null);
        setPosts(Array.isArray(data.posts) ? data.posts : []);
      }
    } catch {
      setPostsError('Failed to load posts.');
    }
    setPostsLoading(false);
  }, []);

  useEffect(() => {
    fetchPosts(selectedPlanId);
  }, [selectedPlanId, fetchPosts]);

  /* ── Handle plan selection ── */
  const handlePlanChange = (e) => {
    const newId = e.target.value;
    setSelectedPlanId(newId);
    setExpandedCard({});
    setRejecting({});
    setRejectNotes({});
    setActionError({});
    setActionLoading({});
  };

  /* ── Toggle expand card ── */
  const toggleExpand = (id) => {
    setExpandedCard((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  /* ── Approve action ── */
  const handleApprove = useCallback(async (id) => {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    setActionError((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch('/api/marketing/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'approve' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError((prev) => ({
          ...prev,
          [id]: data.error || 'An error occurred.',
        }));
      } else {
        // Update local state — don't refetch
        setPosts((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, status: 'copy_approved' } : p
          )
        );
      }
    } catch {
      setActionError((prev) => ({ ...prev, [id]: 'Failed to connect to server.' }));
    }
    setActionLoading((prev) => ({ ...prev, [id]: false }));
  }, []);

  /* ── Request Changes / Reject ── */
  const handleReject = useCallback(async (id) => {
    const notes = rejectNotes[id] || '';
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    setActionError((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch('/api/marketing/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reject', review_notes: notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError((prev) => ({
          ...prev,
          [id]: data.error || 'An error occurred.',
        }));
      } else {
        // Post stays in copy_done but with review_notes saved
        setRejecting((prev) => ({ ...prev, [id]: false }));
        setRejectNotes((prev) => ({ ...prev, [id]: '' }));
        setActionError((prev) => ({ ...prev, [id]: '' }));
      }
    } catch {
      setActionError((prev) => ({ ...prev, [id]: 'Failed to connect to server.' }));
    }
    setActionLoading((prev) => ({ ...prev, [id]: false }));
  }, [rejectNotes]);

  /* ── Start batch image generation (M-4 -> M-5 handoff) ── */
  const handleStartImagery = useCallback(async () => {
    if (!selectedPlanId) return;
    setImageryLoading(true);
    setImageryError('');
    setImageryMessage('');
    try {
      const res = await fetch('/api/marketing/start-imagery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlanId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImageryError(data.error || 'Failed to start image generation.');
      } else {
        setImageryMessage(data.message || 'Image generation queued.');
        await fetchPosts(selectedPlanId); // refresh plan status (-> in_production)
      }
    } catch {
      setImageryError('Failed to connect to server.');
    }
    setImageryLoading(false);
  }, [selectedPlanId, fetchPosts]);

  /* ── Get selected plan display text ── */
  const getPlanLabel = (plan) => {
    const counts = plan.counts || {};
    const total = plan.total_posts || counts.total || 0;
    const pending = counts.pending || 0;
    const approved = counts.approved || 0;
    return `${plan.month} — ${total} posts (${pending} pending, ${approved} approved)`;
  };

  /* ── Render ── */

  return (
    <div>
      {/* ──────── HEADER ──────── */}
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-tight" style={{ color: '#1c1e21' }}>
          Content Review
        </h1>
        <p className="text-[14px] mt-1.5" style={{ color: '#65676b' }}>
          Review and approve monthly marketing content
        </p>
      </div>

      <MarketingTabs />

      {/* ──────── PLAN SELECTOR ──────── */}
      <div
        className="rounded-lg p-4 mb-5"
        style={{ backgroundColor: '#ffffff', border: '1px solid #dadde1' }}
      >
        <label
          className="block text-[13px] font-semibold mb-2"
          style={{ color: '#1c1e21' }}
        >
          <Calendar size={14} className="inline mr-1.5" style={{ color: '#65676b' }} />
          Content Plan
        </label>

        {plansLoading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 size={16} className="animate-spin" style={{ color: '#1877f2' }} />
            <span className="text-[13px]" style={{ color: '#65676b' }}>
              Loading plans...
            </span>
          </div>
        ) : plansError ? (
          <div className="flex items-center gap-2 py-1">
            <span className="text-[13px]" style={{ color: '#c62828' }}>
              {plansError}
            </span>
            <button
              onClick={fetchPlans}
              className="text-[13px] font-semibold underline"
              style={{ color: '#1877f2' }}
            >
              Retry
            </button>
          </div>
        ) : (
          <select
            value={selectedPlanId || ''}
            onChange={handlePlanChange}
            className="w-full px-3 py-2 rounded-md text-[14px] outline-none transition-shadow"
            style={{
              border: '1px solid #dadde1',
              backgroundColor: '#ffffff',
              color: '#1c1e21',
            }}
            onFocus={(e) => {
              e.currentTarget.style.border = '1px solid #1877f2';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(24,119,242,0.15)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = '1px solid #dadde1';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {plans.length === 0 && (
              <option value="">No plans available</option>
            )}
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {getPlanLabel(plan)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ──────── MONTHLY OVERVIEW BAR ──────── */}
      {planInfo && !postsLoading && !postsError && (
        <div
          className="rounded-lg p-4 mb-5 flex flex-wrap items-center gap-x-6 gap-y-2"
          style={{ backgroundColor: '#ffffff', border: '1px solid #dadde1' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#f0f2f5' }}
            >
              <FileText size={14} style={{ color: '#65676b' }} />
            </div>
            <div>
              <span className="text-[22px] font-bold" style={{ color: '#1c1e21' }}>
                {summary.total}
              </span>
              <span className="text-[13px] ml-1" style={{ color: '#65676b' }}>
                posts
              </span>
            </div>
          </div>

          <div className="w-px h-8" style={{ backgroundColor: '#dadde1' }} />

          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: '#b26b00' }}
            />
            <span className="text-[13px]" style={{ color: '#65676b' }}>
              <strong style={{ color: '#1c1e21' }}>{summary.pending}</strong> pending review
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: '#2e7d32' }}
            />
            <span className="text-[13px]" style={{ color: '#65676b' }}>
              <strong style={{ color: '#1c1e21' }}>{summary.approved}</strong> approved
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: '#1877f2' }}
            />
            <span className="text-[13px]" style={{ color: '#65676b' }}>
              <strong style={{ color: '#1c1e21' }}>{summary.withImagery}</strong> with imagery
            </span>
          </div>

          {/* ── M-4 -> M-5 handoff: start batch image generation ── */}
          <div className="ml-auto flex items-center gap-3">
            {imageryError && (
              <span className="text-[12.5px]" style={{ color: '#c62828' }}>{imageryError}</span>
            )}
            {imageryMessage && (
              <span className="text-[12.5px]" style={{ color: '#2e7d32' }}>{imageryMessage}</span>
            )}
            {planInfo.status === 'plan_approved' && summary.pending === 0 && summary.approved > 0 && (
              <button
                onClick={handleStartImagery}
                disabled={imageryLoading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-semibold transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#1877f2', color: '#ffffff' }}
              >
                {imageryLoading
                  ? <Loader2 size={14} className="animate-spin" />
                  : <ImagePlus size={14} />}
                Start Image Generation ({summary.approved})
              </button>
            )}
            {planInfo.status === 'plan_approved' && summary.pending > 0 && (
              <span className="text-[12.5px]" style={{ color: '#8a8d91' }}>
                Review all copy to unlock image generation
              </span>
            )}
            {planInfo.status === 'in_production' && (
              <a
                href="/marketing/images"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-semibold"
                style={{ backgroundColor: '#e7f3ff', color: '#1877f2', border: '1px solid #bcd9f7' }}
              >
                <ImagePlus size={14} />
                Image generation in progress — open Image Review
              </a>
            )}
            {planInfo.status === 'scheduled' && (
              <a
                href="/marketing/schedule"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-semibold"
                style={{ backgroundColor: '#e3f1d8', color: '#1b5e20', border: '1px solid #c5e1b0' }}
              >
                <Calendar size={14} />
                Scheduled — view calendar
              </a>
            )}
          </div>
        </div>
      )}

      {/* ──────── POSTS LIST ──────── */}

      {/* Loading state */}
      {postsLoading && <LoadingSkeleton />}

      {/* Error state */}
      {!postsLoading && postsError && (
        <ErrorState message={postsError} onRetry={() => fetchPosts(selectedPlanId)} />
      )}

      {/* Empty state */}
      {!postsLoading && !postsError && posts.length === 0 && planInfo && <EmptyState />}

      {/* No plan selected */}
      {!postsLoading && !postsError && posts.length === 0 && !planInfo && !plansLoading && (
        <div className="flex flex-col items-center text-center py-12">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: '#f0f2f5' }}
          >
            <Calendar size={22} strokeWidth={1.75} style={{ color: '#65676b' }} />
          </div>
          <p className="text-[14px]" style={{ color: '#65676b' }}>
            Select a plan to view content
          </p>
        </div>
      )}

      {/* Posts cards */}
      {!postsLoading && !postsError && posts.length > 0 && (
        <div className="space-y-3">
          {posts.map((post) => {
            const isExpanded = expandedCard[post.id];
            const isPending = post.status === 'copy_done';
            const isApproved = post.status === 'copy_approved';
            const isLoading = actionLoading[post.id];
            const errMsg = actionError[post.id];
            const isRejecting = rejecting[post.id];
            const postDate = formatDate(post.suggested_date);
            const todayHighlight = isToday(post.suggested_date);

            return (
              <div
                key={post.id}
                className="rounded-lg overflow-hidden transition-shadow hover:shadow-sm"
                style={{
                  backgroundColor: '#ffffff',
                  border: isExpanded ? '1px solid #1877f2' : '1px solid #dadde1',
                }}
              >
                {/* ── Collapsed card header (clickable) ── */}
                <button
                  onClick={() => toggleExpand(post.id)}
                  className="w-full text-left p-4 flex items-start justify-between gap-3"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Date */}
                    <div
                      className="flex-shrink-0 w-14 text-center rounded-md py-1.5"
                      style={{
                        backgroundColor: todayHighlight ? '#e7f3ff' : '#f7f8fa',
                        border: todayHighlight ? '1px solid #1877f2' : '1px solid #dadde1',
                      }}
                    >
                      <div
                        className="text-[11px] font-semibold"
                        style={{ color: todayHighlight ? '#1877f2' : '#65676b' }}
                      >
                        {postDate}
                      </div>
                    </div>

                    {/* Pillar + Topic */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <PillarBadge pillar={post.pillar} />
                        {todayHighlight && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: '#e7f3ff', color: '#1877f2' }}
                          >
                            TODAY
                          </span>
                        )}
                      </div>
                      <h3
                        className="text-[14px] font-semibold truncate mt-0.5"
                        style={{ color: '#1c1e21' }}
                      >
                        {post.topic}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={post.status} />
                    {isExpanded ? (
                      <ChevronDown size={16} style={{ color: '#65676b' }} />
                    ) : (
                      <ChevronRight size={16} style={{ color: '#65676b' }} />
                    )}
                  </div>
                </button>

                {/* ── Expanded content ── */}
                {isExpanded && (
                  <div
                    className="px-4 pb-4 pt-0 border-t"
                    style={{ borderColor: '#e4e6eb' }}
                  >
                    {/* FB Content */}
                    <div className="mb-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center"
                          style={{ backgroundColor: '#e7f3ff' }}
                        >
                          <span className="text-[10px] font-bold" style={{ color: '#1877f2' }}>
                            f
                          </span>
                        </div>
                        <span
                          className="text-[12px] font-semibold"
                          style={{ color: '#1c1e21' }}
                        >
                          Facebook Content
                        </span>
                      </div>
                      <div
                        className="p-3 rounded-md text-[13px] whitespace-pre-wrap leading-relaxed"
                        style={{ backgroundColor: '#f7f8fa', color: '#1c1e21' }}
                      >
                        {post.fb_content || (
                          <span style={{ color: '#8a8d91', fontStyle: 'italic' }}>
                            No Facebook content
                          </span>
                        )}
                      </div>
                    </div>

                    {/* IG Content */}
                    <div className="mb-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center"
                          style={{
                            background:
                              'radial-gradient(circle at 30% 30%, #feda77, #d62b75, #515bd4)',
                          }}
                        >
                          <span className="text-[8px] font-bold text-white">IG</span>
                        </div>
                        <span
                          className="text-[12px] font-semibold"
                          style={{ color: '#1c1e21' }}
                        >
                          Instagram Content
                        </span>
                      </div>
                      <div
                        className="p-3 rounded-md text-[13px] whitespace-pre-wrap leading-relaxed"
                        style={{ backgroundColor: '#f7f8fa', color: '#1c1e21' }}
                      >
                        {post.ig_content || (
                          <span style={{ color: '#8a8d91', fontStyle: 'italic' }}>
                            No Instagram content
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hashtags */}
                    {post.hashtags && (
                      <div className="mb-3">
                        <span
                          className="text-[12px] font-semibold block mb-1"
                          style={{ color: '#65676b' }}
                        >
                          Hashtags
                        </span>
                        <span className="text-[12px]" style={{ color: '#1877f2' }}>
                          {post.hashtags}
                        </span>
                      </div>
                    )}

                    {/* Post Angle */}
                    {post.post_angle && (
                      <div className="mb-3">
                        <span
                          className="text-[12px] font-semibold block mb-1"
                          style={{ color: '#65676b' }}
                        >
                          Post Angle
                        </span>
                        <p className="text-[13px]" style={{ color: '#1c1e21' }}>
                          {post.post_angle}
                        </p>
                      </div>
                    )}

                    {/* Image Status */}
                    <div className="mb-3">
                      <span
                        className="text-[12px] font-semibold block mb-1"
                        style={{ color: '#65676b' }}
                      >
                        Image Status
                      </span>
                      {post.image_url ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle size={14} style={{ color: '#2e7d32' }} />
                          <a
                            href={post.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] underline break-all"
                            style={{ color: '#1877f2' }}
                          >
                            {post.image_url}
                          </a>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Clock size={14} style={{ color: '#b26b00' }} />
                          <span className="text-[13px]" style={{ color: '#b26b00' }}>
                            {post.image_status === 'pending' || !post.image_status
                              ? 'Image not yet generated'
                              : post.image_status}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Review Notes (if any) */}
                    {post.review_notes && (
                      <div className="mb-3">
                        <span
                          className="text-[12px] font-semibold block mb-1"
                          style={{ color: '#65676b' }}
                        >
                          Previous Review Notes
                        </span>
                        <p
                          className="text-[13px] p-2 rounded-md"
                          style={{
                            backgroundColor: '#fff4d6',
                            color: '#7a4900',
                          }}
                        >
                          {post.review_notes}
                        </p>
                      </div>
                    )}

                    {/* ── Action error ── */}
                    {errMsg && (
                      <div
                        className="rounded-md p-3 mb-3 flex items-start gap-2"
                        style={{ backgroundColor: '#fde2e1', border: '1px solid #f5b1ae' }}
                      >
                        <XCircle size={15} style={{ color: '#c62828', flexShrink: 0, marginTop: 1 }} />
                        <p className="text-[12px]" style={{ color: '#a01818' }}>
                          {errMsg}
                        </p>
                      </div>
                    )}

                    {/* ── Action buttons (only for copy_done) ── */}
                    {isPending && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {/* Approve button */}
                        <button
                          onClick={() => handleApprove(post.id)}
                          disabled={isLoading}
                          className="px-4 py-1.5 rounded-md text-[13px] font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: '#2e7d32', color: '#ffffff' }}
                          onMouseEnter={(e) => {
                            if (!e.currentTarget.disabled)
                              e.currentTarget.style.backgroundColor = '#1f5a23';
                          }}
                          onMouseLeave={(e) => {
                            if (!e.currentTarget.disabled)
                              e.currentTarget.style.backgroundColor = '#2e7d32';
                          }}
                        >
                          {isLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle size={14} />
                          )}
                          Approve
                        </button>

                        {/* Request Changes / Confirm Reject */}
                        {!isRejecting ? (
                          <button
                            onClick={() =>
                              setRejecting((prev) => ({ ...prev, [post.id]: true }))
                            }
                            disabled={isLoading}
                            className="px-4 py-1.5 rounded-md text-[13px] font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: '#b26b00', color: '#ffffff' }}
                            onMouseEnter={(e) => {
                              if (!e.currentTarget.disabled)
                                e.currentTarget.style.backgroundColor = '#8a5100';
                            }}
                            onMouseLeave={(e) => {
                              if (!e.currentTarget.disabled)
                                e.currentTarget.style.backgroundColor = '#b26b00';
                            }}
                          >
                            <MessageSquare size={14} />
                            Request Changes
                          </button>
                        ) : (
                          <div className="flex flex-col gap-2 w-full">
                            <textarea
                              value={rejectNotes[post.id] || ''}
                              onChange={(e) =>
                                setRejectNotes((prev) => ({
                                  ...prev,
                                  [post.id]: e.target.value,
                                }))
                              }
                              placeholder="Describe what needs to change..."
                              rows={3}
                              className="w-full px-3 py-2 rounded-md text-[13px] outline-none transition-shadow resize-none"
                              style={{
                                border: '1px solid #dadde1',
                                backgroundColor: '#ffffff',
                                color: '#1c1e21',
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.border = '1px solid #1877f2';
                                e.currentTarget.style.boxShadow =
                                  '0 0 0 3px rgba(24,119,242,0.15)';
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.border = '1px solid #dadde1';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleReject(post.id)}
                                disabled={isLoading}
                                className="px-4 py-1.5 rounded-md text-[13px] font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: '#b26b00', color: '#ffffff' }}
                                onMouseEnter={(e) => {
                                  if (!e.currentTarget.disabled)
                                    e.currentTarget.style.backgroundColor = '#8a5100';
                                }}
                                onMouseLeave={(e) => {
                                  if (!e.currentTarget.disabled)
                                    e.currentTarget.style.backgroundColor = '#b26b00';
                                }}
                              >
                                {isLoading ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <XCircle size={14} />
                                )}
                                Confirm
                              </button>
                              <button
                                onClick={() => {
                                  setRejecting((prev) => ({
                                    ...prev,
                                    [post.id]: false,
                                  }));
                                  setRejectNotes((prev) => ({
                                    ...prev,
                                    [post.id]: '',
                                  }));
                                }}
                                disabled={isLoading}
                                className="px-4 py-1.5 rounded-md text-[13px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: '#f2f3f5', color: '#1c1e21' }}
                                onMouseEnter={(e) => {
                                  if (!e.currentTarget.disabled)
                                    e.currentTarget.style.backgroundColor = '#e0e1e4';
                                }}
                                onMouseLeave={(e) => {
                                  if (!e.currentTarget.disabled)
                                    e.currentTarget.style.backgroundColor = '#f2f3f5';
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Approved badge (no actions) ── */}
                    {isApproved && (
                      <div className="flex items-center gap-2 mt-2">
                        <CheckCircle size={16} style={{ color: '#2e7d32' }} />
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: '#2e7d32' }}
                        >
                          Approved ✓
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}