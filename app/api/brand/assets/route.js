import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

const BUCKET = 'content-images';
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES = { 'image/png': '.png', 'image/webp': '.webp', 'image/jpeg': '.jpg', 'image/svg+xml': '.svg' };
// 'font' 是延后子阶段：自定义字体要随容器 fc-cache 安装，未装的族名会让
// sharp 静默输出空白字形。在字体链路真正打通前不接收字体上传。
const KINDS = ['product', 'logo', 'photo'];

/** List brand assets, optionally filtered by ?kind= */
export async function GET(request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }
  const kind = new URL(request.url).searchParams.get('kind');
  let q = supabase.from('brand_assets').select('*').order('sort_order').order('created_at');
  if (kind) q = q.eq('kind', kind);
  const { data, error } = await q;
  if (error) {
    console.error('brand assets list failed:', error.message);
    return NextResponse.json({ error: 'Failed to load assets' }, { status: 500 });
  }
  return NextResponse.json(data);
}

/**
 * Upload a brand asset. multipart/form-data:
 *   { file, kind, name?, series?, default_product_slot?, has_transparency? }
 * has_transparency is detected in the browser (canvas alpha scan) and sent
 * along — the compose worker does its own authoritative sharp alpha check at
 * compose time, so this is only a UI hint for the white-card behaviour.
 */
export async function POST(request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }
  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  const kind = form.get('kind');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: `kind must be one of: ${KINDS.join(', ')}` }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File too large (max 12 MB).' }, { status: 400 });
  }

  const ext = IMAGE_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: `Unsupported type "${file.type}". Allowed: ${Object.keys(IMAGE_TYPES).join(', ')}` }, { status: 400 });
  }

  const name = (form.get('name') || file.name || 'untitled').toString().slice(0, 120);
  const series = form.get('series') ? form.get('series').toString().slice(0, 80) : null;
  const slot = form.get('default_product_slot') ? form.get('default_product_slot').toString() : null;
  const hasTransparency = form.get('has_transparency') === 'true'
    ? true
    : form.get('has_transparency') === 'false' ? false : null;

  const safeName = name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 40) || 'asset';
  const suffix = crypto.randomUUID().slice(0, 8);
  const storagePath = `brand-assets/${kind}/${safeName}-${Date.now()}-${suffix}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (upErr) {
    console.error('brand asset storage upload failed:', upErr.message);
    return NextResponse.json({ error: `Storage upload failed: ${upErr.message}` }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = pub?.publicUrl;

  const { data, error } = await supabase
    .from('brand_assets')
    .insert({
      kind,
      name,
      storage_path: storagePath,
      public_url: publicUrl,
      series,
      default_product_slot: slot,
      has_transparency: hasTransparency,
      is_active: true,
      sort_order: 0,
    })
    .select()
    .single();

  if (error) {
    // Roll back the orphaned upload so Storage doesn't accumulate junk
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    console.error('brand asset insert failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, asset: data });
}
