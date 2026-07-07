import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

/**
 * Image review endpoint (M-5) — Dashboard side of the six review exits.
 *
 * Actions:
 *   'approve'        image_ready -> approved (gate passed, ready to schedule/publish)
 *   'regenerate'     image_ready -> image_retry (bot worker regenerates)
 *   'change_scene'   image_ready -> image_retry + review_notes='[scene] <text>'
 *   'change_product' image_ready -> image_retry + review_notes='[product-next]'
 *   'edit_compose'   image_ready -> image_retry + review_notes='[recompose]'
 *                    merges { texts, product, title_slot, product_slot } into
 *                    compose_spec (and source_product_image); the worker
 *                    recomposes deterministically — no AI call, seconds-fast
 *   'skip'           image_ready|image_retry -> approved + image_source='skipped'
 *
 * The regenerate/change actions only write DB state; the bot's background
 * worker consumes status='image_retry' and runs the imagery pipeline. The
 * review_notes markers are parsed and cleared by the worker.
 *
 * (The sixth exit, "upload own", is /api/marketing/image-upload.)
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

  const { id, action, scene, texts, product, title_slot, product_slot } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const ACTIONS = ['approve', 'regenerate', 'change_scene', 'change_product', 'edit_compose', 'skip'];
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: `action must be one of: ${ACTIONS.join(', ')}` }, { status: 400 });
  }
  if (action === 'change_scene' && !(scene || '').trim()) {
    return NextResponse.json({ error: 'scene description is required for change_scene' }, { status: 400 });
  }
  if (action === 'edit_compose' && !texts && !product && !title_slot && !product_slot) {
    return NextResponse.json({ error: 'edit_compose needs at least one of: texts, product, title_slot, product_slot' }, { status: 400 });
  }

  // Read current status
  const { data: current, error: readError } = await supabase
    .from('content_calendar')
    .select('id, status, image_url, compose_spec')
    .eq('id', id)
    .single();

  if (readError || !current) {
    return NextResponse.json({ error: 'Row not found' }, { status: 404 });
  }

  // Allowed source states per action. 'skip' also rescues rows stuck in
  // image_retry (e.g. generation kept failing).
  const allowedStates = action === 'skip'
    ? ['image_ready', 'image_retry']
    : ['image_ready'];

  if (!allowedStates.includes(current.status)) {
    return NextResponse.json({
      error: `Cannot ${action} — row is in "${current.status}" state (expected ${allowedStates.join(' or ')})`,
      currentStatus: current.status,
    }, { status: 409 });
  }

  let updateData;
  switch (action) {
    case 'approve':
      updateData = { status: 'approved' };
      break;
    case 'regenerate':
      updateData = { status: 'image_retry', review_notes: null };
      break;
    case 'change_scene':
      updateData = { status: 'image_retry', review_notes: `[scene] ${scene.trim()}` };
      break;
    case 'change_product':
      updateData = { status: 'image_retry', review_notes: '[product-next]' };
      break;
    case 'edit_compose': {
      // Merge edits into compose_spec; the worker's [recompose] path reuses
      // the stored cloud background and re-runs deterministic composition.
      const spec = (current.compose_spec && typeof current.compose_spec === 'object')
        ? { ...current.compose_spec }
        : {};
      if (texts && typeof texts === 'object') {
        const clean = {};
        for (const [k, v] of Object.entries(texts)) {
          if (typeof v === 'string' && v.trim()) clean[k] = v.trim();
        }
        spec.texts = clean;
      }
      if (typeof title_slot === 'string' && title_slot) spec.title_slot = title_slot;
      if (typeof product_slot === 'string' && product_slot) spec.product_slot = product_slot;
      updateData = {
        status: 'image_retry',
        review_notes: '[recompose]',
        compose_spec: spec,
      };
      if (typeof product === 'string' && product) {
        // source_product_image 是产品选择的唯一事实源（worker 端以它为准）
        updateData.source_product_image = product;
        spec.product = product;
      }
      break;
    }
    case 'skip':
      updateData = { status: 'approved', image_source: 'skipped' };
      break;
  }

  // TOCTOU guard: conditional PATCH with status filter
  const { data: updated, error: updateError } = await supabase
    .from('content_calendar')
    .update(updateData)
    .eq('id', id)
    .eq('status', current.status)
    .select();

  if (updateError) {
    console.error('image-review update failed:', updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    const { data: actual } = await supabase
      .from('content_calendar')
      .select('status')
      .eq('id', id)
      .single();

    return NextResponse.json({
      error: 'Conflict — row status changed before update completed',
      currentStatus: actual?.status || 'unknown',
    }, { status: 409 });
  }

  return NextResponse.json({ success: true, row: updated[0] });
}
