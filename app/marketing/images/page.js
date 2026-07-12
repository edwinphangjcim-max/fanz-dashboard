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
  PenLine,
  MessageSquare,
  X,
  Send,
} from 'lucide-react';
import MarketingTabs from '../tabs';

const POLL_MS = 30_000; // worker generates asynchronously; keep the queue fresh

// ── Chat panel for "Discuss & Regenerate" ──────────────────────────────────

function ChatPanel({ row, onClose, onRegenerated }) {
  const [messages, setMessages] = useState([]);   // { role, content, sender_name }
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [done, setDone] = useState(false); // true once regeneration triggered
  const bottomRef = useRef(null);

  // Load history on mount
  useEffect(() => {
    fetch(`/api/image-chat?calendarId=${row.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMessages(data.map((m) => ({
            role: m.role,
            content: m.content,
            sender_name: m.sender_name,
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [row.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || done) return;
    setInput('');
    setSending(true);
    const optimistic = { role: 'user', content: text, sender_name: null };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch('/api/image-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId: row.id, userMessage: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${data.error || 'Something went wrong'}`, sender_name: 'Mark' }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, sender_name: 'Mark' }]);
        if (data.regenerating) {
          setDone(true);
          if (onRegenerated) onRegenerated();
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: Could not reach server.', sender_name: 'Mark' }]);
    }
    setSending(false);
  }, [input, sending, done, row.id, onRegenerated]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    // Overlay
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div
        style={{
          width: '100%', maxWidth: 420,
          backgroundColor: '#ffffff',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #dadde1',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1c1e21' }}>
              Discuss &amp; Regenerate
            </div>
            <div style={{ fontSize: 12, color: '#65676b', marginTop: 2 }}>
              {row.topic || '(untitled)'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: '#65676b', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Mark intro hint */}
        <div
          style={{
            margin: '10px 12px 0',
            padding: '8px 10px',
            backgroundColor: '#e7f3ff',
            borderRadius: 8,
            fontSize: 12,
            color: '#1877f2',
            flexShrink: 0,
          }}
        >
          Tell Mark what you dislike about the background. He will propose options and only submit a new generation once you confirm.
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loadingHistory && (
            <div style={{ textAlign: 'center', color: '#8a8d91', fontSize: 12, paddingTop: 20 }}>
              <Loader2 size={16} style={{ display: 'inline', color: '#1877f2' }} /> Loading history...
            </div>
          )}
          {!loadingHistory && messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#8a8d91', fontSize: 12, paddingTop: 20 }}>
              No messages yet. Start by telling Mark what you want to change.
            </div>
          )}
          {messages.map((m, i) => {
            const isAssistant = m.role === 'assistant';
            return (
              <div key={i} style={{ display: 'flex', justifyContent: isAssistant ? 'flex-end' : 'flex-start' }}>
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '8px 12px',
                    borderRadius: isAssistant
                      ? '4px 16px 16px 16px'
                      : '16px 4px 16px 16px',
                    backgroundColor: isAssistant ? '#1877f2' : '#f0f2f5',
                    color: isAssistant ? '#ffffff' : '#1c1e21',
                    fontSize: 13,
                    lineHeight: 1.45,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {m.content}
                  <div style={{ fontSize: 10, marginTop: 4, opacity: 0.65, textAlign: isAssistant ? 'right' : 'left' }}>
                    {isAssistant ? 'Mark' : 'You'}
                  </div>
                </div>
              </div>
            );
          })}
          {sending && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div
                style={{
                  padding: '8px 12px', borderRadius: '4px 16px 16px 16px',
                  backgroundColor: '#e7f3ff', fontSize: 12, color: '#1877f2',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Mark is typing...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Done notice */}
        {done && (
          <div
            style={{
              margin: '0 12px 8px',
              padding: '10px 12px',
              backgroundColor: '#e6f4ea',
              border: '1px solid #b7dfbf',
              borderRadius: 8,
              fontSize: 12,
              color: '#1e7e34',
              flexShrink: 0,
            }}
          >
            Mark has submitted the new background for regeneration. Refresh the queue in a minute to see the result.
          </div>
        )}

        {/* Input */}
        {!done && (
          <div
            style={{
              padding: '10px 12px',
              borderTop: '1px solid #dadde1',
              display: 'flex', gap: 8, alignItems: 'flex-end',
              flexShrink: 0,
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Tell Mark what to change..."
              rows={2}
              disabled={sending}
              style={{
                flex: 1,
                resize: 'none',
                border: '1px solid #dadde1',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 13,
                color: '#1c1e21',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.4,
              }}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              style={{
                backgroundColor: '#1877f2',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: sending || !input.trim() ? 0.5 : 1,
                flexShrink: 0,
                display: 'flex', alignItems: 'center',
              }}
            >
              <Send size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Mirrors fanz-marketing-bot assets/products/ — update together when the
// product asset library changes.
const PRODUCT_OPTIONS = [
  { value: 'grande-l.svg', label: 'Grande L Series' },
  { value: 'aura-series.svg', label: 'Aura Series' },
  { value: 'smart-series.svg', label: 'Smart Series' },
  { value: 'fs-series-563.svg', label: 'FS Series 563' },
  { value: 'air-cooler-01.svg', label: 'Air Cooler' },
  { value: 'fanz-product-test.png', label: 'Product Photo (test)' },
];

const TITLE_SLOT_OPTIONS = [
  { value: 'bottom_center', label: 'Text at bottom' },
  { value: 'middle_center', label: 'Text in middle' },
  { value: 'top_center', label: 'Text at top' },
];

const PRODUCT_SLOT_OPTIONS = [
  { value: 'top_center', label: 'Product upper center' },
  { value: 'center', label: 'Product center' },
  { value: 'center_right', label: 'Product right' },
];

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
  const [editOpen, setEditOpen] = useState({});        // rowId -> compose edit panel open
  const [editDraft, setEditDraft] = useState({});      // rowId -> { texts, product, title_slot, product_slot }
  const [chatOpen, setChatOpen] = useState(null);      // rowId or null
  const fileInputs = useRef({});

  const openEditPanel = useCallback((row) => {
    // Two independent top-level setters — no side effects inside an updater
    // (StrictMode double-invokes updaters).
    const next = !editOpen[row.id];
    if (next) {
      // Prefill from compose_spec (worker's record of the last composition),
      // falling back to the row's topic as the title.
      const spec = (row.compose_spec && typeof row.compose_spec === 'object') ? row.compose_spec : {};
      const texts = spec.texts || {};
      setEditDraft((d) => ({
        ...d,
        [row.id]: {
          title: texts.title ?? row.topic ?? '',
          selling_point: texts.selling_point ?? '',
          cta: texts.cta ?? '',
          product: spec.product || row.source_product_image || PRODUCT_OPTIONS[0].value,
          title_slot: spec.title_slot || 'bottom_center',
          product_slot: spec.product_slot || 'top_center',
        },
      }));
    }
    setEditOpen((p) => ({ ...p, [row.id]: next }));
  }, [editOpen]);


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
        setEditOpen((p) => ({ ...p, [id]: false }));
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
                            <ActionButton
                              icon={PenLine}
                              label="Edit Text & Layout"
                              disabled={busy}
                              onClick={() => openEditPanel(row)}
                            />
                            <ActionButton
                              icon={MessageSquare}
                              label="Discuss & Regenerate"
                              disabled={busy}
                              onClick={() => setChatOpen(row.id)}
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

                    {/* Compose edit panel — text / product / layout; saving triggers a
                        fast deterministic recompose (no AI regeneration) */}
                    {editOpen[row.id] && canReview && editDraft[row.id] && (
                      <div
                        className="mt-2.5 rounded-md p-3 flex flex-col gap-2"
                        style={{ backgroundColor: '#f7f8fa', border: '1px solid #dadde1' }}
                      >
                        {[
                          { key: 'title', ph: 'Headline (main text on the image)' },
                          { key: 'selling_point', ph: 'Selling point (optional second line)' },
                          { key: 'cta', ph: 'Call to action, e.g. "DM us today" (optional)' },
                        ].map(({ key, ph }) => (
                          <input
                            key={key}
                            type="text"
                            value={editDraft[row.id][key]}
                            onChange={(e) => setEditDraft((d) => ({
                              ...d, [row.id]: { ...d[row.id], [key]: e.target.value },
                            }))}
                            placeholder={ph}
                            className="px-2.5 py-1.5 rounded-md text-[13px] outline-none"
                            style={{ border: '1px solid #dadde1', color: '#1c1e21', backgroundColor: '#fff' }}
                          />
                        ))}
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: 'product', options: PRODUCT_OPTIONS },
                            { key: 'title_slot', options: TITLE_SLOT_OPTIONS },
                            { key: 'product_slot', options: PRODUCT_SLOT_OPTIONS },
                          ].map(({ key, options }) => (
                            <select
                              key={key}
                              value={editDraft[row.id][key]}
                              onChange={(e) => setEditDraft((d) => ({
                                ...d, [row.id]: { ...d[row.id], [key]: e.target.value },
                              }))}
                              className="px-2 py-1.5 rounded-md text-[12.5px] outline-none"
                              style={{ border: '1px solid #dadde1', color: '#1c1e21', backgroundColor: '#fff' }}
                            >
                              {options.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <ActionButton
                            primary
                            icon={CheckCircle}
                            label="Save & Recompose"
                            disabled={busy || !(editDraft[row.id].title || '').trim()}
                            onClick={() => {
                              const draft = editDraft[row.id];
                              doAction(row.id, 'edit_compose', {
                                texts: {
                                  title: draft.title,
                                  selling_point: draft.selling_point,
                                  cta: draft.cta,
                                },
                                product: draft.product,
                                title_slot: draft.title_slot,
                                product_slot: draft.product_slot,
                              });
                            }}
                          />
                          <span className="text-[11.5px]" style={{ color: '#8a8d91' }}>
                            Recomposes on the same background — fast, no AI regeneration
                          </span>
                        </div>
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
                        {row.review_notes === '[recompose]'
                          ? 'The bot is recomposing this image with your edits (no AI regeneration — usually under a minute).'
                          : <>The bot is regenerating this image
                            {row.review_notes?.startsWith('[scene]') ? ' with a new scene' : ''}
                            {row.review_notes === '[product-next]' ? ' with the next product image' : ''}
                            . It reappears here when ready.</>}
                        {' '}You can still upload your own or skip.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Discuss & Regenerate chat panel */}
      {chatOpen && (() => {
        const chatRow = rows.find((r) => r.id === chatOpen);
        if (!chatRow) return null;
        return (
          <ChatPanel
            row={chatRow}
            onClose={() => setChatOpen(null)}
            onRegenerated={() => {
              fetchRows(true);
              // Keep panel open so user sees the done notice
            }}
          />
        );
      })()}
    </div>
  );
}
