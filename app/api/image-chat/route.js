import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = 'openai/gpt-4o';
const SCENE_RE = /\|\|SCENE\|\|(.+?)\|\|END\|\|\s*$/s;

function buildSystemPrompt(row) {
  const topic = (row.topic || '').slice(0, 200);
  const fbContent = (row.fb_content || '').slice(0, 300);
  const notes = row.review_notes || 'none';
  return `You are Mark, the dedicated AI marketing manager for this brand (Fanz ceiling fans, Malaysia). You are helping the customer refine the AI-generated BACKGROUND of a marketing image. Personality: like a sharp, reliable Malaysian agency account manager — brief, concrete, always propose options rather than asking open-ended questions. Match the customer's language (English / Chinese / Bahasa Melayu). No emoji. Never repeat the exact same sentence twice in this conversation.

CONTEXT OF THIS POST (you know everything about it):
- Topic: ${topic}
- Copy (FB): ${fbContent}
- Current scene/notes: ${notes}
- The image is composed of: an AI-generated background + the product photo + logo + caption text overlaid deterministically. You can ONLY change the BACKGROUND. Product photo, logo and text positions are edited elsewhere (Edit Text & Layout).

YOUR JOB — strict two-phase:
PHASE 1 (understand): Ask what they dislike and what they want instead. Be specific and propose concrete directions (e.g. "warmer evening lighting? minimalist white walls? no sofa?"). Do NOT trigger regeneration yet. Keep each reply short, max 3 sentences + at most one question.
PHASE 2 (confirm then act): When you believe you fully understand, summarise the new background in one sentence and ask the customer to confirm. ONLY after the customer clearly confirms (yes/ok/对/好/boleh/confirm), output your final reply and on the LAST LINE alone output exactly:
||SCENE||<one concise English scene description for the image model: room type, style, lighting, colours, what to avoid. No brand names, no text, no people, no fan (the fan is composited separately)>||END||
Never output the marker before explicit customer confirmation. If the customer changes direction, go back to Phase 1.`;
}

export async function GET(request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const calendarId = searchParams.get('calendarId');
  if (!calendarId) {
    return NextResponse.json({ error: 'calendarId required' }, { status: 400 });
  }

  const chatId = `post:${calendarId}`;
  const { data, error } = await supabase
    .from('conversations')
    .select('id, role, content, sender_name, created_at, ai_model_used')
    .eq('chat_id', chatId)
    .eq('platform', 'dashboard')
    .order('created_at', { ascending: true })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || []);
}

export async function POST(request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { calendarId, userMessage } = body;
  if (!calendarId || !userMessage) {
    return NextResponse.json({ error: 'calendarId and userMessage required' }, { status: 400 });
  }

  // 1. Fetch calendar row
  const { data: calRow, error: calError } = await supabase
    .from('content_calendar')
    .select('id, topic, fb_content, review_notes, compose_spec, image_url')
    .eq('id', calendarId)
    .single();

  if (calError || !calRow) {
    return NextResponse.json({ error: 'Calendar row not found' }, { status: 404 });
  }

  // 2. Fetch conversation history
  const chatId = `post:${calendarId}`;
  const { data: history } = await supabase
    .from('conversations')
    .select('role, content')
    .eq('chat_id', chatId)
    .eq('platform', 'dashboard')
    .order('created_at', { ascending: true })
    .limit(30);

  const historyMessages = (history || []).map((h) => ({
    role: h.role,
    content: h.content,
  }));

  // 3. Call OpenRouter
  const messages = [
    { role: 'system', content: buildSystemPrompt(calRow) },
    ...historyMessages,
    { role: 'user', content: userMessage },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50000);
  let assistantReply;
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://fanz-dashboard.vercel.app',
        'X-Title': 'Fanz Image Chat',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 400,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const t = (await resp.text()).slice(0, 200);
      return NextResponse.json({ error: `LLM error ${resp.status}: ${t}` }, { status: 502 });
    }
    const llmData = await resp.json();
    assistantReply = llmData.choices?.[0]?.message?.content || '';
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'LLM request timed out.' : err.message;
    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  // 4. Check for scene marker
  const sceneMatch = assistantReply.match(SCENE_RE);
  const regenerating = !!sceneMatch;
  let cleanReply = assistantReply;
  if (sceneMatch) {
    cleanReply = assistantReply.slice(0, assistantReply.length - sceneMatch[0].length).trimEnd();
  }

  // 5. Persist conversation (fire-and-forget — failures don't block the response)
  const now = new Date().toISOString();
  Promise.all([
    supabase.from('conversations').insert({
      chat_id: chatId,
      role: 'user',
      content: userMessage,
      platform: 'dashboard',
      sender_name: null,
      message_type: 'text',
      ai_model_used: null,
      created_at: now,
    }),
    supabase.from('conversations').insert({
      chat_id: chatId,
      role: 'assistant',
      content: assistantReply,
      platform: 'dashboard',
      sender_name: 'Mark',
      message_type: 'text',
      ai_model_used: 'gpt-4o',
      created_at: new Date(Date.now() + 1).toISOString(), // +1ms so ordering is stable
    }),
  ]).catch(() => {});

  // 6. If scene confirmed, patch the calendar row
  if (sceneMatch) {
    const sceneDesc = sceneMatch[1].trim();
    await supabase
      .from('content_calendar')
      .update({
        review_notes: `[scene] ${sceneDesc}`,
        status: 'image_retry',
      })
      .eq('id', calendarId);
  }

  return NextResponse.json({ reply: cleanReply, regenerating });
}
