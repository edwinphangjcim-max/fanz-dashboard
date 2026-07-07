'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Palette, Type, ImageIcon, Package, Upload, Loader2, AlertCircle,
  CheckCircle, Trash2, Save, Info,
} from 'lucide-react';

const PRODUCT_SLOTS = [
  { value: 'top_center', label: 'Upper center' },
  { value: 'center', label: 'Center' },
  { value: 'center_right', label: 'Right' },
];
const TITLE_SLOTS = [
  { value: 'bottom_center', label: 'Text at bottom' },
  { value: 'middle_center', label: 'Text in middle' },
  { value: 'top_center', label: 'Text at top' },
];
const COLOR_FIELDS = [
  { key: 'title', label: 'Title text' },
  { key: 'stroke', label: 'Text outline' },
  { key: 'cta_fill', label: 'CTA badge' },
  { key: 'cta_stroke', label: 'CTA outline' },
];

/** Read the alpha channel of an image file in the browser — true if any pixel
 *  is not fully opaque. A UI hint only (worker does the authoritative check). */
function detectTransparency(file) {
  return new Promise((resolve) => {
    if (file.type === 'image/jpeg') return resolve(false); // jpeg has no alpha
    if (file.type === 'image/svg+xml') return resolve(true); // treat svg as transparent
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        const w = (c.width = Math.min(img.width, 200));
        const h = (c.height = Math.min(img.height, 200));
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let transparent = false;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 250) { transparent = true; break; }
        }
        resolve(transparent);
      } catch { resolve(null); }
      finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function Card({ icon: Icon, title, desc, children }) {
  return (
    <div className="rounded-lg mb-5" style={{ backgroundColor: '#fff', border: '1px solid #dadde1' }}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid #eff0f2' }}>
        <div className="flex items-center gap-2">
          <Icon size={17} style={{ color: '#1877f2' }} />
          <h2 className="text-[15px] font-semibold" style={{ color: '#1c1e21' }}>{title}</h2>
        </div>
        {desc && <p className="text-[12.5px] mt-1" style={{ color: '#65676b' }}>{desc}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function BrandPage() {
  const [kit, setKit] = useState(null);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingKit, setSavingKit] = useState(false);
  const [kitSaved, setKitSaved] = useState(false);
  const [busy, setBusy] = useState({});
  const logoInput = useRef(null);
  const productInput = useRef(null);

  const load = useCallback(async () => {
    try {
      const [k, a] = await Promise.all([
        fetch('/api/brand/kit').then((r) => r.json()),
        fetch('/api/brand/assets').then((r) => r.json()),
      ]);
      if (k.error) setError(k.error);
      else setKit(k);
      setAssets(Array.isArray(a) ? a : []);
    } catch {
      setError('Failed to load brand kit.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveKit = useCallback(async () => {
    setSavingKit(true); setKitSaved(false);
    try {
      const res = await fetch('/api/brand/kit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colors: kit.colors, background_style: kit.background_style,
          brand_voice: kit.brand_voice, default_layout: kit.default_layout,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Save failed');
      else { setKitSaved(true); setTimeout(() => setKitSaved(false), 2500); }
    } catch { setError('Save failed.'); }
    setSavingKit(false);
  }, [kit]);

  const uploadAssets = useCallback(async (files, kind) => {
    const key = kind === 'logo' ? 'logo' : 'products';
    setBusy((p) => ({ ...p, [key]: true }));
    setError('');
    for (const file of files) {
      const transparent = await detectTransparency(file);
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      form.append('name', file.name.replace(/\.[^.]+$/, ''));
      if (transparent !== null) form.append('has_transparency', String(transparent));
      const res = await fetch('/api/brand/assets', { method: 'POST', body: form });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(`${file.name}: ${d.error || 'upload failed'}`);
      }
    }
    // If a logo was uploaded, point the kit at the newest logo
    if (kind === 'logo') {
      const fresh = await fetch('/api/brand/assets?kind=logo').then((r) => r.json());
      const newest = Array.isArray(fresh) && fresh[fresh.length - 1];
      if (newest) {
        await fetch('/api/brand/kit', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logo_asset_id: newest.id }),
        });
      }
    }
    await load();
    setBusy((p) => ({ ...p, [key]: false }));
  }, [load]);

  const patchAsset = useCallback(async (id, patch) => {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    await fetch(`/api/brand/assets/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
  }, []);

  const deleteAsset = useCallback(async (id) => {
    await fetch(`/api/brand/assets/${id}`, { method: 'DELETE' });
    await load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 justify-center">
        <Loader2 size={18} className="animate-spin" style={{ color: '#1877f2' }} />
        <span className="text-[14px]" style={{ color: '#65676b' }}>Loading brand kit…</span>
      </div>
    );
  }

  const products = assets.filter((a) => a.kind === 'product');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-tight" style={{ color: '#1c1e21' }}>Brand Kit</h1>
        <p className="text-[14px] mt-1.5" style={{ color: '#65676b' }}>
          Your logo, colours, voice and product library — everything the AI uses to keep posts on-brand.
        </p>
      </div>

      {error && (
        <div className="rounded-lg p-3 mb-5 flex items-center gap-2" style={{ backgroundColor: '#fde2e1', border: '1px solid #f5c6c5' }}>
          <AlertCircle size={15} style={{ color: '#d32f2f' }} />
          <span className="text-[13px]" style={{ color: '#d32f2f' }}>{error}</span>
        </div>
      )}

      {/* Logo */}
      <Card icon={ImageIcon} title="Logo" desc="Shown top-left on every post. A transparent PNG looks best.">
        <div className="flex items-center gap-4">
          <div className="w-40 h-24 rounded-md flex items-center justify-center overflow-hidden"
            style={{ background: 'repeating-conic-gradient(#f0f2f5 0% 25%, #fff 0% 50%) 50% / 20px 20px', border: '1px solid #dadde1' }}>
            {kit?.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={kit.logo_url} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%' }} />
              : <span className="text-[12px]" style={{ color: '#8a8d91' }}>No logo</span>}
          </div>
          <div>
            <button onClick={() => logoInput.current?.click()} disabled={busy.logo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#1877f2', color: '#fff' }}>
              {busy.logo ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Upload / Replace
            </button>
            <input ref={logoInput} type="file" accept="image/png,image/svg+xml,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadAssets([f], 'logo'); }} />
            <p className="text-[11.5px] mt-2" style={{ color: '#8a8d91' }}>PNG, SVG or WebP · max 12 MB</p>
          </div>
        </div>
      </Card>

      {/* Colors */}
      <Card icon={Palette} title="Colours" desc="Used for post text and the call-to-action badge.">
        <div className="flex flex-wrap gap-5">
          {COLOR_FIELDS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2.5">
              <input type="color" value={kit?.colors?.[key] || '#000000'}
                onChange={(e) => setKit((k) => ({ ...k, colors: { ...k.colors, [key]: e.target.value } }))}
                className="w-9 h-9 rounded cursor-pointer" style={{ border: '1px solid #dadde1' }} />
              <div>
                <div className="text-[12.5px] font-medium" style={{ color: '#1c1e21' }}>{label}</div>
                <div className="text-[11px] font-mono" style={{ color: '#8a8d91' }}>{kit?.colors?.[key]}</div>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {/* Voice & Style */}
      <Card icon={Type} title="Voice & Style" desc="The tone of the copy and the look of the AI-generated backgrounds.">
        <label className="block mb-4">
          <span className="text-[13px] font-medium" style={{ color: '#1c1e21' }}>Brand voice (drives the copywriting)</span>
          <textarea rows={3} value={kit?.brand_voice || ''}
            onChange={(e) => setKit((k) => ({ ...k, brand_voice: e.target.value }))}
            className="mt-1.5 w-full px-3 py-2 rounded-md text-[13px] outline-none"
            style={{ border: '1px solid #dadde1', color: '#1c1e21' }} />
        </label>
        <label className="block mb-4">
          <span className="text-[13px] font-medium" style={{ color: '#1c1e21' }}>Background style (drives the AI backgrounds)</span>
          <textarea rows={2} value={kit?.background_style || ''}
            onChange={(e) => setKit((k) => ({ ...k, background_style: e.target.value }))}
            className="mt-1.5 w-full px-3 py-2 rounded-md text-[13px] outline-none"
            style={{ border: '1px solid #dadde1', color: '#1c1e21' }} />
        </label>
        <div className="flex flex-wrap gap-3">
          {[['title_slot', 'Default text position', TITLE_SLOTS], ['product_slot', 'Default product position', PRODUCT_SLOTS]].map(([field, label, opts]) => (
            <label key={field} className="flex flex-col gap-1">
              <span className="text-[12px]" style={{ color: '#65676b' }}>{label}</span>
              <select value={kit?.default_layout?.[field] || opts[0].value}
                onChange={(e) => setKit((k) => ({ ...k, default_layout: { ...k.default_layout, [field]: e.target.value } }))}
                className="px-2.5 py-1.5 rounded-md text-[13px] outline-none" style={{ border: '1px solid #dadde1', color: '#1c1e21', backgroundColor: '#fff' }}>
                {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-5">
          <button onClick={saveKit} disabled={savingKit}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#1877f2', color: '#fff' }}>
            {savingKit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save brand kit
          </button>
          {kitSaved && <span className="flex items-center gap-1 text-[13px]" style={{ color: '#31a24c' }}><CheckCircle size={14} /> Saved</span>}
        </div>
      </Card>

      {/* Product library */}
      <Card icon={Package} title="Product Library"
        desc="Product images the AI composes into posts. Transparent PNGs sit cleanly on the background; others get a white card.">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => productInput.current?.click()} disabled={busy.products}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#1877f2', color: '#fff' }}>
            {busy.products ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload products
          </button>
          <input ref={productInput} type="file" accept="image/png,image/webp,image/jpeg,image/svg+xml" multiple className="hidden"
            onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ''; if (fs.length) uploadAssets(fs, 'product'); }} />
          <span className="text-[12px]" style={{ color: '#8a8d91' }}>Select several at once</span>
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center text-center py-10">
            <Package size={22} style={{ color: '#8a8d91' }} />
            <p className="text-[13px] mt-2" style={{ color: '#65676b' }}>No products yet — upload your real product images to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {products.map((a) => (
              <div key={a.id} className="rounded-md overflow-hidden" style={{ border: '1px solid #dadde1', opacity: a.is_active ? 1 : 0.5 }}>
                <div className="h-28 flex items-center justify-center"
                  style={{ background: 'repeating-conic-gradient(#f0f2f5 0% 25%, #fff 0% 50%) 50% / 16px 16px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.public_url} alt={a.name} style={{ maxWidth: '90%', maxHeight: '90%' }} />
                </div>
                <div className="p-2.5">
                  <input value={a.name} onChange={(e) => setAssets((p) => p.map((x) => x.id === a.id ? { ...x, name: e.target.value } : x))}
                    onBlur={(e) => patchAsset(a.id, { name: e.target.value })}
                    className="w-full text-[12.5px] font-medium px-1.5 py-1 rounded outline-none mb-1.5"
                    style={{ border: '1px solid #eff0f2', color: '#1c1e21' }} />
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {a.has_transparency === false && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: '#fff4d6', color: '#b26b00' }}>
                        <Info size={9} /> white card
                      </span>
                    )}
                    {a.has_transparency === true && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#e5f7ea', color: '#31a24c' }}>transparent</span>
                    )}
                  </div>
                  <select value={a.default_product_slot || 'top_center'} onChange={(e) => patchAsset(a.id, { default_product_slot: e.target.value })}
                    className="w-full text-[11.5px] px-1.5 py-1 rounded outline-none mb-1.5" style={{ border: '1px solid #eff0f2', color: '#1c1e21', backgroundColor: '#fff' }}>
                    {PRODUCT_SLOTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-[11.5px]" style={{ color: '#65676b' }}>
                      <input type="checkbox" checked={a.is_active} onChange={(e) => patchAsset(a.id, { is_active: e.target.checked })} />
                      Active
                    </label>
                    <button onClick={() => deleteAsset(a.id)} className="p-1 rounded" style={{ color: '#d32f2f' }} title="Remove">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
