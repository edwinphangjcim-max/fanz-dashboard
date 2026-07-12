import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

export const dynamic = 'force-dynamic';

// Returns the conversation log grouped into per-customer threads.
// Each thread: { chat_id, sender_name, platform, message_count, last_at, messages[] }
// messages are ordered oldest→newest so the UI can render them like a chat.
export async function GET() {
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

  // Pull the most recent rows (cap to keep the response bounded), then group.
  // At current volumes this is a single cheap query; revisit with pagination if
  // the table grows large.
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const threads = new Map();
  for (const row of data || []) {
    let t = threads.get(row.chat_id);
    if (!t) {
      t = {
        chat_id: row.chat_id,
        sender_name: null,
        platform: row.platform || 'telegram',
        message_count: 0,
        last_at: row.created_at,
        messages: [],
      };
      threads.set(row.chat_id, t);
    }
    t.messages.push(row);
    t.message_count += 1;
    // rows arrive newest-first; keep the newest customer name we see
    if (!t.sender_name && row.role === 'user' && row.sender_name) t.sender_name = row.sender_name;
    if (row.created_at > t.last_at) t.last_at = row.created_at;
  }

  const result = Array.from(threads.values())
    .map((t) => ({ ...t, messages: t.messages.slice().reverse() })) // oldest→newest for display
    .sort((a, b) => (a.last_at < b.last_at ? 1 : -1)); // most-recent thread first

  return NextResponse.json(result);
}
