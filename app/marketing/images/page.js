'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle,
  RefreshCw,
  Clapperboard,
  Package,
  Upload,
  SkipForward,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  Hourglass,
} from 'lucide-react';
import MarketingTabs from '../tabs';

const POLL_MS = 30_000; // worker generates asynchronously; keep the queue fresh

const PILLAR_EMOJI = {
  product: '🛒', case: '🏠', promo: '🎉', story: '📖', educational: '📚',
};

function StatusChip({ row }) {
  let label, bg, text;
  if (row.status === 'image_ready') {
    label = 'Awaiting review'; bg = '#e7f3ff'; text = '#1877f2';
  } else if (row.status === 'image_retry') {
    label = row.image_status === 'generating' ? 'Regenerating…' : 'Regeneration queued';
    bg = '#fff4d6'; text = '#b26b00';
  } else if (row.image_status === 'generating') {
    label = 'Generating…'; bg = '#fff4d6'; text = '#b26b00';
  } else if (row.plan && row.plan.status === 'in_production') {
    label = 'Queued'; bg = '#f0f2f5'; text = '#65676b';
  } else {
    // copy approved but batch generation never started for this plan
    label = 'Not started'; bg = '#fde2e1'; text = '#d32f2f';
  }
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}

function ActionButton({ onClick, disabled, icon: Icon, label, primary, danger }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-opacity disabled:opacity-50"
      style={{
        backgroundColor: primary ? '#1877f2' : danger ? '#fde2e1' : '#f0f2f5',
        color: primary ? '#ffffff' : danger ? '#d32f2f' : '#1c1e21',
        border: primary ? 'none' : '1px solid #dadde1',
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

export default function ImageReviewPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [actionError, setActionError] = useState({});
  const [sceneInput, setSceneInput] = useState({});   // rowId -> scene text (open = editing)
  const [sceneOpen, setSceneOpen] = useState({});
  const fileInputs = useRef({});

  const fetchRows = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/marketing/pending-images');
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setError('');
        setRows(Array.isArray(data) ? data : []);
      }
    } catch {
      setError('Failed to load image queue.');
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows(false);
    const t = setInterval(() => fetchRows(true), POLL_MS);
    return () => clearInterval(t);
  }, [fetchRows]);

  const doAction = useCallback(async (id, action, extra = {}) => {
    setActionLoading((p) => ({ ...p, [id]: true }));
    setActionError((p) => ({ ...p, [id]: '' }));
    try {
      const res = await fetch('/api/marketing/image-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError((p) => ({ ...p, [id]: data.error || 'An error occurred.' }));
      } else {
        setSceneOpen((p) => ({ ...p, [id]: false }));
        await fetchRows(true);
      }
    } catch {
      setActionError((p) => ({ ...p, [id]: 'Failed to connect to server.' }));
    }
    setActionLoading((p) => ({ ...p, [id]: false }));
  }, [fetchRows]);

  const doUpload = useCallback(async (id, file) => {
    if (!file) return;
    setActionLoading((p) => ({ ...p, [id]: true }));
    setActionError((p) => ({ ...p, [id]: '' }));
    try {
      const form = new FormData();
      form.append('id', id);
      form.append('file', file);
      const res = await fetch('/api/marketing/image-upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setActionError((p) => ({ ...p, [id]: data.error || 'Upload failed.' }));
      } else {
        await fetchRows(true);
      }
    } catch {
      setActionError((p) => ({ ...p, [id]: 'Failed to connect to server.' }));
    }
    setActionLoading((p) => ({ ...p, [id]: false }));
  }, [fetchRows]);

  /* Group rows by plan month, singles last */
  const groups = {};
  for (const row of rows) {
    const key = row.plan ? `${row.plan.month}` : 'Single posts';
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }

  const reviewable = rows.filter((r) => r.status === 'image_ready').length;
  const inFlight = rows.filter((r) => r.status !== 'image_ready').length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-tight" style={{ color: '#1c1e21' }}>
          Image Review
        </h1>
        <p className="text-[14px] mt-1.5" style={{ color: '#65676b' }}>
          Review generated imagery — approve, regenerate, adjust, upload your own, or skip
        </p>
      </div>

      <MarketingTabs />

      {/* Summary bar */}
      {!loading && !error && (
        <div
          className="rounded-lg p-3.5 mb-5 flex items-center gap-6"
          style={{ backgroundColor: '#ffffff', border: '1px solid #dadde1' }}
        >
          <span className="text-[13px]" style={{ color: '#65676b' }}>
            <strong style={{ color: '#1c1e21' }}>{reviewable}</strong> awaiting your review
          </span>
          <span className="text-[13px]" style={{ color: '#65676b' }}>
            <strong style={{ color: '#1c1e21' }}>{inFlight}</strong> generating / queued
          </span>
          <button
            onClick={() => fetchRows(false)}
            className="ml-auto flex items-center gap-1.5 text-[12.5px] font-semibold"
            style={{ color: '#1877f2' }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-8 justify-center">
          <Loader2 size={18} className="animate-spin" style={{ color: '#1877f2' }} />
          <span className="text-[14px]" style={{ color: '#65676b' }}>Loading image queue...</span>
        </div>
      )}

      {!loading && error && (
        <div
          className="rounded-lg p-4 flex items-center gap-2"
          style={{ backgroundColor: '#fde2e1', border: '1px solid #f5c6c5' }}
        >
          <AlertCircle size={16} style={{ color: '#d32f2f' }} />
          <span className="text-[13px]" style={{ color: '#d32f2f' }}>{error}</span>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="flex flex-col items-center text-center py-12">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: '#f0f2f5' }}
          >
            <ImageIcon size={22} strokeWidth={1.75} style={{ color: '#65676b' }} />
          </div>
          <p className="text-[14px]" style={{ color: '#65676b' }}>
            No posts in the imagery phase.
          </p>
          <p className="text-[13px] mt-1" style={{ color: '#8a8d91' }}>
            Approve copy in Content Review, then press "Start Image Generation".
          </p>
        </div>
      )}

      {!loading && !error && Object.entries(groups).map(([groupLabel, groupRows]) => (
        <div key={groupLabel} className="mb-6">
          <h2 className="text-[15px] font-semibold mb-3" style={{ color: '#1c1e21' }}>
            {groupLabel}
            <span className="text-[13px] font-normal ml-2" style={{ color: '#65676b' }}>
              {groupRows.length} post(s)
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {groupRows.map((row) => {
              const busy = actionLoading[row.id];
              const errMsg = actionError[row.id];
              const canReview = row.status === 'image_ready';
              const canRescue = row.status === 'image_retry'; // skip / upload as escape hatches

              return (
                <div
                  key={row.id}
                  className="rounded-lg overflow-hidden"
                  style={{ backgroundColor: '#ffffff', border: '1px solid #dadde1' }}
                >
                  {/* Image preview */}
                  <div
                    className="w-full flex items-center justify-center"
                    style={{ backgroundColor: '#f0f2f5', minHeight: 180, maxHeight: 320, overflow: 'hidden' }}
                  >
                    {row.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.image_url}
                        alt={row.topic || 'Generated image'}
                        style={{ width: '100%', objectFit: 'cover', maxHeight: 320 }}
                      />
                    ) : (
                      <div className="flex flex-col items-center py-10">
                        <Hourglass size={22} style={{ color: '#8a8d91' }} />
                        <span className="text-[12px] mt-2" style={{ color: '#8a8d91' }}>
                          {row.image_status === 'generating' ? 'Generating image…' : 'Image not generated yet'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-3.5">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-[12px]">{PILLAR_EMOJI[row.pillar] || '📝'} {row.pillar}</span>
                      <StatusChip row={row} />
                      {row.suggested_date && (
                        <span className="text-[11px]" style={{ color: '#8a8d91' }}>{row.suggested_date}</span>
                      )}
                    </div>
                    <h3 className="text-[14px] font-semibold mb-2.5" style={{ color: '#1c1e21' }}>
                      {row.topic || '(untitled)'}
                    </h3>

                    {errMsg && (
                      <div className="text-[12px] mb-2" style={{ color: '#d32f2f' }}>{errMsg}</div>
                    )}

                    {/* Six exits */}
                    {(canReview || canRescue) && (
                      <div className="flex flex-wrap gap-1.5">
                        {canReview && (
                          <>
                            <ActionButton
                              primary
                              icon={CheckCircle}
                              label="Approve"
                              disabled={busy}
                              onClick={() => doAction(row.id, 'approve')}
                            />
                            <ActionButton
                              icon={RefreshCw}
                              label="Regenerate"
                              disabled={busy}
                              onClick={() => doAction(row.id, 'regenerate')}
                            />
                            <ActionButton
                              icon={Clapperboard}
                              label="Change Scene"
                              disabled={busy}
                              onClick={() => setSceneOpen((p) => ({ ...p, [row.id]: !p[row.id] }))}
                            />
                            <ActionButton
                              icon={Package}
                              label="Change Product"
                              disabled={busy}
                              onClick={() => doAction(row.id, 'change_product')}
                            />
                          </>
                        )}
                        <ActionButton
                          icon={Upload}
                          label="Upload Own"
                          disabled={busy}
                          onClick={() => fileInputs.current[row.id]?.click()}
                        />
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          ref={(el) => { fileInputs.current[row.id] = el; }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            doUpload(row.id, f);
                          }}
                        />
                        <ActionButton
                          danger
                          icon={SkipForward}
                          label="Skip Image"
                          disabled={busy}
                          onClick={() => doAction(row.id, 'skip')}
                        />
                        {busy && <Loader2 size={16} className="animate-spin mt-1.5" style={{ color: '#1877f2' }} />}
                      </div>
                    )}

                    {/* Change-scene inline input */}
                    {sceneOpen[row.id] && canReview && (
                      <div className="mt-2.5 flex gap-1.5">
                        <input
                          type="text"
                          value={sceneInput[row.id] || ''}
                          onChange={(e) => setSceneInput((p) => ({ ...p, [row.id]: e.target.value }))}
                          placeholder='Describe the new scene, e.g. "a cozy bedroom at dusk"'
                          className="flex-1 px-2.5 py-1.5 rounded-md text-[13px] outline-none"
                          style={{ border: '1px solid #dadde1', color: '#1c1e21' }}
                        />
                        <ActionButton
                          primary
                          icon={Clapperboard}
                          label="Go"
                          disabled={busy || !(sceneInput[row.id] || '').trim()}
                          onClick={() => doAction(row.id, 'change_scene', { scene: sceneInput[row.id] })}
                        />
                      </div>
                    )}

                    {/* Not-started hint: batch generation was never triggered for this plan */}
                    {row.status === 'copy_approved' && row.image_status !== 'generating' &&
                      (!row.plan || row.plan.status !== 'in_production') && (
                      <p className="text-[12px] mt-1" style={{ color: '#d32f2f' }}>
                        Image generation has not been started for this plan. Go to{' '}
                        <a href="/marketing" className="underline font-semibold">Content Review</a>, select the plan
                        and press "Start Image Generation".
                      </p>
                    )}

                    {/* Retry-in-progress hint */}
                    {row.status === 'image_retry' && (
                      <p className="text-[12px] mt-2" style={{ color: '#8a8d91' }}>
                        The bot is regenerating this image
                        {row.review_notes?.startsWith('[scene]') ? ' with a new scene' : ''}
                        {row.review_notes === '[product-next]' ? ' with the next product image' : ''}
                        . It reappears here when ready. You can still upload your own or skip.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
