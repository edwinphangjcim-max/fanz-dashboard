'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader2, AlertCircle, Check, Globe, ArrowRight } from 'lucide-react';

const CHECK_BG = 'repeating-conic-gradient(#f0f2f5 0% 25%, #fff 0% 50%) 50% / 16px 16px';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState('input'); // input | review | saving
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [signals, setSignals] = useState(null);
  const [draft, setDraft] = useState(null); // editable review state
  const [progress, setProgress] = useState('');

  const analyze = useCallback(async () => {
    if (!url.trim()) return;
    setBusy(true); setError(''); setProgress('Reading the website…');
    try {
      const res = await fetch('/api/brand/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const s = await res.json();
      if (!res.ok) { setError(s.error || 'Could not analyze the site.'); setBusy(false); return; }
      setSignals(s);

      setProgress('Understanding the brand voice and look…');
      let voice = { brand_voice: '', background_style: '' };
      try {
        const vr = await fetch('/api/brand/analyze-voice', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brand_name: s.brand_name_guess, text_samples: s.text_samples, image_urls: s.product_images.slice(0, 3) }),
        });
        if (vr.ok) voice = await vr.json();
      } catch { /* voice is best-effort; user can fill it */ }

      setDraft({
        website_url: s.url,
        brand_name: s.brand_name_guess || '',
        tagline: s.tagline_guess || '',
        brand_color: s.brand_color_guess || '#1877f2',
        logo: s.logo_candidates[0] || '',
        brand_voice: voice.brand_voice || '',
        background_style: voice.background_style || '',
        selectedProducts: s.product_images.slice(0, 6),
      });
      setStep('review');
    } catch {
      setError('Something went wrong analyzing the site.');
    }
    setBusy(false); setProgress('');
  }, [url]);

  const toggleProduct = (img) => setDraft((d) => ({
    ...d,
    selectedProducts: d.selectedProducts.includes(img)
      ? d.selectedProducts.filter((x) => x !== img)
      : [...d.selectedProducts, img],
  }));

  const save = useCallback(async () => {
    setStep('saving'); setError(''); setBusy(true);
    try {
      const referer = draft.website_url;
      // 1) import logo
      let logoAssetId = null;
      if (draft.logo) {
        setProgress('Saving your logo…');
        const r = await fetch('/api/brand/assets/import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: draft.logo, kind: 'logo', name: `${draft.brand_name} logo`, referer }),
        });
        const d = await r.json();
        if (r.ok) logoAssetId = d.asset.id;
      }
      // 2) import selected products
      let done = 0;
      for (const img of draft.selectedProducts) {
        setProgress(`Importing products… ${++done}/${draft.selectedProducts.length}`);
        await fetch('/api/brand/assets/import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: img, kind: 'product', referer }),
        }).catch(() => {});
      }
      // 3) save the kit
      setProgress('Saving your brand kit…');
      const kitBody = {
        colors: { title: '#FFFFFF', stroke: '#1A1A1A', cta_fill: draft.brand_color, cta_stroke: '#1A1A1A' },
        brand_voice: draft.brand_voice,
        background_style: draft.background_style,
        website_url: draft.website_url,
        tagline: draft.tagline,
        onboarded: true,
      };
      if (logoAssetId) kitBody.logo_asset_id = logoAssetId;
      const kr = await fetch('/api/brand/kit', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kitBody),
      });
      if (!kr.ok) {
        const d = await kr.json();
        setError(d.error || 'Failed to save the brand kit.'); setStep('review'); setBusy(false); setProgress(''); return;
      }
      router.push('/marketing');
    } catch {
      setError('Failed to save. Please try again.'); setStep('review'); setBusy(false); setProgress('');
    }
  }, [draft, router]);

  // ── INPUT ──
  if (step === 'input') {
    return (
      <div className="max-w-xl mx-auto pt-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={20} style={{ color: '#1877f2' }} />
          <h1 className="text-[24px] font-semibold tracking-tight" style={{ color: '#1c1e21' }}>Let&apos;s set up your brand</h1>
        </div>
        <p className="text-[14px] mb-6" style={{ color: '#65676b' }}>
          Paste your website and we&apos;ll pull in your logo, colours, voice and product photos automatically. You can review and edit everything before it&apos;s saved.
        </p>
        <div className="rounded-lg p-5" style={{ backgroundColor: '#fff', border: '1px solid #dadde1' }}>
          <label className="text-[13px] font-medium flex items-center gap-1.5 mb-2" style={{ color: '#1c1e21' }}>
            <Globe size={14} /> Your website
          </label>
          <div className="flex gap-2">
            <input
              type="text" value={url} onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && analyze()}
              placeholder="fanz.my"
              className="flex-1 px-3 py-2 rounded-md text-[14px] outline-none"
              style={{ border: '1px solid #dadde1', color: '#1c1e21' }}
            />
            <button onClick={analyze} disabled={busy || !url.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-[14px] font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#1877f2', color: '#fff' }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Analyze
            </button>
          </div>
          {busy && progress && <p className="text-[12.5px] mt-3" style={{ color: '#65676b' }}>{progress}</p>}
          {error && <div className="flex items-center gap-1.5 mt-3 text-[13px]" style={{ color: '#d32f2f' }}><AlertCircle size={14} />{error}</div>}
          <p className="text-[12px] mt-4" style={{ color: '#8a8d91' }}>No website? You can skip and fill the Brand Kit in manually later.</p>
        </div>
        <button onClick={() => router.push('/brand')} className="text-[13px] mt-4" style={{ color: '#65676b' }}>Skip for now →</button>
      </div>
    );
  }

  // ── REVIEW ──
  return (
    <div className="max-w-2xl mx-auto pt-6">
      <div className="flex items-center gap-2 mb-1">
        <Check size={20} style={{ color: '#31a24c' }} />
        <h1 className="text-[24px] font-semibold tracking-tight" style={{ color: '#1c1e21' }}>Review your brand</h1>
      </div>
      <p className="text-[14px] mb-5" style={{ color: '#65676b' }}>
        Here&apos;s what we found. Edit anything, then save — you can always change it later in Brand Kit.
      </p>
      {error && <div className="rounded-lg p-3 mb-4 flex items-center gap-2" style={{ backgroundColor: '#fde2e1', border: '1px solid #f5c6c5' }}><AlertCircle size={15} style={{ color: '#d32f2f' }} /><span className="text-[13px]" style={{ color: '#d32f2f' }}>{error}</span></div>}

      {draft && (
        <div className="space-y-4">
          {/* logo + color */}
          <div className="rounded-lg p-4 flex items-center gap-5" style={{ backgroundColor: '#fff', border: '1px solid #dadde1' }}>
            <div className="w-32 h-20 rounded-md flex items-center justify-center overflow-hidden" style={{ background: CHECK_BG, border: '1px solid #dadde1' }}>
              {draft.logo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={draft.logo} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                : <span className="text-[12px]" style={{ color: '#8a8d91' }}>No logo</span>}
            </div>
            <div className="flex-1">
              {signals?.logo_candidates?.length > 1 && (
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {signals.logo_candidates.map((l) => (
                    <button key={l} onClick={() => setDraft((d) => ({ ...d, logo: l }))}
                      className="w-11 h-11 rounded flex items-center justify-center overflow-hidden"
                      style={{ background: CHECK_BG, border: draft.logo === l ? '2px solid #1877f2' : '1px solid #dadde1' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l} alt="" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                    </button>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2.5">
                <input type="color" value={draft.brand_color} onChange={(e) => setDraft((d) => ({ ...d, brand_color: e.target.value }))}
                  className="w-9 h-9 rounded cursor-pointer" style={{ border: '1px solid #dadde1' }} />
                <div>
                  <div className="text-[12.5px] font-medium" style={{ color: '#1c1e21' }}>Brand colour (accent / CTA)</div>
                  <div className="text-[11px] font-mono" style={{ color: '#8a8d91' }}>{draft.brand_color}</div>
                </div>
              </label>
            </div>
          </div>

          {/* text fields */}
          {[
            { k: 'brand_name', label: 'Brand name', rows: 1 },
            { k: 'tagline', label: 'Tagline / positioning', rows: 2 },
            { k: 'brand_voice', label: 'Brand voice (drives the copywriting)', rows: 3 },
            { k: 'background_style', label: 'Background style (drives the AI backgrounds)', rows: 2 },
          ].map(({ k, label, rows }) => (
            <div key={k} className="rounded-lg p-4" style={{ backgroundColor: '#fff', border: '1px solid #dadde1' }}>
              <label className="text-[13px] font-medium block mb-1.5" style={{ color: '#1c1e21' }}>{label}</label>
              {rows === 1
                ? <input value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ border: '1px solid #dadde1', color: '#1c1e21' }} />
                : <textarea rows={rows} value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ border: '1px solid #dadde1', color: '#1c1e21' }} />}
            </div>
          ))}

          {/* products */}
          <div className="rounded-lg p-4" style={{ backgroundColor: '#fff', border: '1px solid #dadde1' }}>
            <div className="text-[13px] font-medium mb-1" style={{ color: '#1c1e21' }}>
              Product images to import ({draft.selectedProducts.length} selected)
            </div>
            <p className="text-[12px] mb-3" style={{ color: '#8a8d91' }}>Tap to include/exclude. These go into your product library.</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {(signals?.product_images || []).map((img) => {
                const on = draft.selectedProducts.includes(img);
                return (
                  <button key={img} onClick={() => toggleProduct(img)}
                    className="relative h-20 rounded-md overflow-hidden flex items-center justify-center"
                    style={{ background: CHECK_BG, border: on ? '2px solid #1877f2' : '1px solid #dadde1' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" style={{ maxWidth: '100%', maxHeight: '100%', opacity: on ? 1 : 0.5 }} />
                    {on && <span className="absolute top-1 right-1 rounded-full p-0.5" style={{ backgroundColor: '#1877f2' }}><Check size={10} color="#fff" /></span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1 pb-8">
            <button onClick={save} disabled={busy}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-md text-[14px] font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#1877f2', color: '#fff' }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />} Save &amp; go to Marketing
            </button>
            {step === 'saving' && progress && <span className="text-[12.5px]" style={{ color: '#65676b' }}>{progress}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
