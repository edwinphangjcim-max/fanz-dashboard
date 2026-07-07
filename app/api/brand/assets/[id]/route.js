import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

const BUCKET = 'content-images';
const EDITABLE = ['name', 'series', 'keywords', 'default_product_slot', 'is_active', 'sort_order'];

/** Update a brand asset's metadata (rename, series, slot, active toggle, order). */
export async function PATCH(request, { params }) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }
  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const patch = {};
  for (const k of EDITABLE) {
    if (k in body) patch[k] = body[k];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: `Nothing to update. Editable: ${EDITABLE.join(', ')}` }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('brand_assets')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('brand asset patch failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, asset: data });
}

/**
 * Delete a brand asset. Default is a soft delete (is_active=false) so any
 * compose_spec that already references it keeps resolving. ?hard=true also
 * removes the Storage object and the row (only safe for never-used uploads).
 */
export async function DELETE(request, { params }) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }
  const { id } = await params;
  const hard = new URL(request.url).searchParams.get('hard') === 'true';

  if (!hard) {
    const { error } = await supabase.from('brand_assets').update({ is_active: false }).eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, softDeleted: true });
  }

  const { data: asset } = await supabase.from('brand_assets').select('storage_path').eq('id', id).single();
  if (asset?.storage_path) {
    await supabase.storage.from(BUCKET).remove([asset.storage_path]).catch(() => {});
  }
  const { error } = await supabase.from('brand_assets').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, hardDeleted: true });
}
