import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import { BROWSER_UA } from '@/app/lib/brand-analyzer';

const BUCKET = 'content-images';
const MAX_BYTES = 12 * 1024 * 1024;
const EXT_BY_TYPE = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/svg+xml': '.svg' };
const KINDS = ['product', 'logo', 'photo'];

/**
 * Import a brand asset FROM A URL (onboarding auto-import). The server fetches
 * the image with a browser UA + referer — many sites (incl. fanz.my) block
 * naive hotlink fetches — then stores it like a normal upload.
 * POST { url, kind, name?, referer? }
 */
export async function POST(request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const url = (body.url || '').trim();
  const kind = body.kind;
  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: `kind must be one of: ${KINDS.join(', ')}` }, { status: 400 });
  }

  let bytes, contentType;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const referer = body.referer || new URL(url).origin + '/';
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Referer: referer, Accept: 'image/*' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Could not fetch image (HTTP ${res.status})` }, { status: 422 });
    }
    contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return NextResponse.json({ error: 'Empty image' }, { status: 422 });
    if (buf.length > MAX_BYTES) return NextResponse.json({ error: 'Image too large (max 12 MB)' }, { status: 422 });
    bytes = buf;
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Image fetch timed out' : 'Failed to fetch image';
    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  const ext = EXT_BY_TYPE[contentType] || (url.match(/\.(png|jpe?g|webp|svg)(\?|$)/i) ? '.' + RegExp.$1.toLowerCase().replace('jpeg', 'jpg') : '.png');
  const name = (body.name || url.split('/').pop().split('?')[0] || 'imported').toString().slice(0, 120);
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 40) || 'asset';
  const suffix = crypto.randomUUID().slice(0, 8);
  const storagePath = `brand-assets/${kind}/${safe}-${Date.now()}-${suffix}${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: contentType || 'image/png', upsert: false });
  if (upErr) {
    return NextResponse.json({ error: `Storage upload failed: ${upErr.message}` }, { status: 500 });
  }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  const { data, error } = await supabase
    .from('brand_assets')
    .insert({ kind, name, storage_path: storagePath, public_url: pub?.publicUrl, is_active: true, sort_order: 0 })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, asset: data });
}
