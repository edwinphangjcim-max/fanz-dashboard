import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

/**
 * Brand kit config (single row, id=1) — colors, fonts, brand voice,
 * background style, default layout. Read + update from the /brand page.
 * The compose worker reads the same row (lib/brand.js) with a 60s cache.
 */
export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }
  const { data, error } = await supabase
    .from('brand_kit')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    console.error('brand kit read failed:', error.message);
    return NextResponse.json({ error: 'Failed to load brand kit' }, { status: 500 });
  }

  // Resolve logo public_url for preview
  let logo_url = null;
  if (data.logo_asset_id) {
    const { data: logo } = await supabase
      .from('brand_assets')
      .select('public_url')
      .eq('id', data.logo_asset_id)
      .single();
    logo_url = logo?.public_url || null;
  }
  return NextResponse.json({ ...data, logo_url });
}

const ALLOWED = ['logo_asset_id', 'colors', 'fonts', 'background_style', 'brand_voice', 'default_layout',
  'onboarded', 'website_url', 'tagline'];

export async function PUT(request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Whitelist the columns a client may touch
  const patch = {};
  for (const k of ALLOWED) {
    if (k in body) patch[k] = body[k];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: `Nothing to update. Allowed: ${ALLOWED.join(', ')}` }, { status: 400 });
  }

  // Merge jsonb columns instead of replacing — a partial body (e.g. just one
  // colour) must not wipe the other keys from the singleton.
  const JSONB_COLS = ['colors', 'fonts', 'default_layout'];
  if (JSONB_COLS.some((c) => c in patch)) {
    const { data: existing } = await supabase.from('brand_kit').select('colors,fonts,default_layout').eq('id', 1).single();
    for (const c of JSONB_COLS) {
      if (c in patch && patch[c] && typeof patch[c] === 'object') {
        patch[c] = { ...(existing?.[c] || {}), ...patch[c] };
      }
    }
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('brand_kit')
    .update(patch)
    .eq('id', 1)
    .select()
    .single();

  if (error) {
    console.error('brand kit update failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, kit: data });
}
