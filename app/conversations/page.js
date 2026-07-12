'use client';

import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

export default function ConversationsPage() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/conversations');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setThreads(data);
        if (data.length) setSelected(data[0].chat_id);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const active = threads.find((t) => t.chat_id === selected);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-tight" style={{ color: '#1c1e21' }}>
          Conversations
        </h1>
        <p className="text-[14px] mt-1.5" style={{ color: '#65676b' }}>
          Full customer chat history — what each customer said and what the AI replied.
        </p>
      </div>

      {loading ? (
        <div className="px-4 py-16 text-center text-[14px]" style={{ color: '#8a8d91' }}>Loading...</div>
      ) : error ? (
        <div className="px-4 py-16 text-center text-[14px]" style={{ color: '#c62828' }}>{error}</div>
      ) : threads.length === 0 ? (
        <div
          className="flex flex-col items-center text-center py-20 rounded-lg"
          style={{ backgroundColor: '#ffffff', border: '1px solid #dadde1' }}
        >
          <MessageSquare size={26} strokeWidth={1.75} style={{ color: '#1877f2' }} />
          <p className="text-[14px] mt-3" style={{ color: '#65676b' }}>
            No conversations logged yet. They appear here as customers chat with the bot.
          </p>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: '300px 1fr' }}>
          {/* Thread list */}
          <div
            className="rounded-lg overflow-hidden self-start"
            style={{ backgroundColor: '#ffffff', border: '1px solid #dadde1', maxHeight: '70vh', overflowY: 'auto' }}
          >
            {threads.map((t) => {
              const isActive = t.chat_id === selected;
              const last = t.messages[t.messages.length - 1];
              return (
                <button
                  key={t.chat_id}
                  onClick={() => setSelected(t.chat_id)}
                  className="w-full text-left px-3 py-2.5 transition-colors"
                  style={{
                    borderBottom: '1px solid #ebedf0',
                    backgroundColor: isActive ? '#e7f3ff' : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = '#fafbfc'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold truncate" style={{ color: '#1c1e21' }}>
                      {t.sender_name || `Chat ${t.chat_id}`}
                    </span>
                    <span className="text-[10px] whitespace-nowrap" style={{ color: '#8a8d91' }}>
                      {t.message_count}
                    </span>
                  </div>
                  <div className="text-[11px] truncate mt-0.5" style={{ color: '#65676b' }}>
                    {last ? `${last.role === 'assistant' ? 'AI: ' : ''}${last.content}` : ''}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: '#8a8d91' }}>
                    {t.platform} · {fmtTime(t.last_at)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected thread */}
          <div
            className="rounded-lg overflow-hidden"
            style={{ backgroundColor: '#ffffff', border: '1px solid #dadde1' }}
          >
            {active && (
              <>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid #ebedf0' }}>
                  <div className="text-[14px] font-semibold" style={{ color: '#1c1e21' }}>
                    {active.sender_name || `Chat ${active.chat_id}`}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: '#65676b' }}>
                    {active.platform} · chat_id {active.chat_id} · {active.message_count} messages
                  </div>
                </div>
                <div className="px-4 py-4 space-y-3" style={{ maxHeight: '62vh', overflowY: 'auto' }}>
                  {active.messages.map((m) => {
                    const isAI = m.role === 'assistant';
                    return (
                      <div key={m.id} className={`flex ${isAI ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-[75%]">
                          <div
                            className="px-3 py-2 rounded-2xl text-[13px] whitespace-pre-wrap break-words"
                            style={{
                              backgroundColor: isAI ? '#1877f2' : '#f0f2f5',
                              color: isAI ? '#ffffff' : '#1c1e21',
                              borderTopRightRadius: isAI ? 4 : 16,
                              borderTopLeftRadius: isAI ? 16 : 4,
                            }}
                          >
                            {m.content}
                          </div>
                          <div
                            className={`flex items-center gap-1.5 mt-1 text-[10px] ${isAI ? 'justify-end' : 'justify-start'}`}
                            style={{ color: '#8a8d91' }}
                          >
                            <span>{isAI ? (m.sender_name || 'AI') : (m.sender_name || 'Customer')}</span>
                            <span>·</span>
                            <span>{fmtTime(m.created_at)}</span>
                            {m.message_type && m.message_type !== 'text' && (
                              <span
                                className="px-1 rounded"
                                style={{ backgroundColor: '#fff4d6', color: '#b26b00' }}
                              >
                                {m.message_type}
                              </span>
                            )}
                            {m.intent && (
                              <span
                                className="px-1 rounded"
                                style={{ backgroundColor: '#f0e7ff', color: '#7b3ff2' }}
                              >
                                {m.intent}
                              </span>
                            )}
                            {isAI && m.ai_model_used && (
                              <span
                                className="px-1 rounded"
                                style={{ backgroundColor: '#e3f1d8', color: '#2e7d32' }}
                              >
                                {m.ai_model_used}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
