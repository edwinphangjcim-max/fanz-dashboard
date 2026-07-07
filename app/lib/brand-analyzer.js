// ============================================
// brand-analyzer.js — 零品牌耦合的网站品牌提取器
//
// 输入一个网址，抓取并提取品牌信号：文字（定位/声音素材）+ 视觉
// （logo 候选、产品图、主色线索、字体、社媒）。纯确定性，不调 LLM。
// 对任何品牌通用——不含任何 Fanz 假设（这正是"以后给别的品牌用"的地基）。
//
// 移植自 Marqos 的 cheerio 爬虫思路（文字/SEO 信号），并补上 Marqos
// 缺的视觉提取（logo/产品图/色板/字体）——出图最吃这块。
//
// 抓 HTML 用普通 fetch 即可（实测 fanz.my 200）；下载图片资产可能撞
// 防盗链，需带浏览器 UA + referer（调用方处理）。
// ============================================

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120 Safari/537.36';

function absolutize(src, base) {
  if (!src) return null;
  if (src.startsWith('//')) return 'https:' + src;
  try { return new URL(src, base).href; } catch { return null; }
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Fetch and extract brand signals from a URL.
 * @param {string} url
 * @returns {Promise<object>} structured signals (see shape below)
 */
async function analyzeWebsite(url) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let html, finalUrl = url, status;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      redirect: 'follow',
      signal: controller.signal,
    });
    status = res.status;
    finalUrl = res.url || url;
    html = await res.text();
  } finally {
    clearTimeout(timer);
  }
  if (!html || html.length < 200) {
    return { ok: false, error: `Could not read the page (HTTP ${status})`, url };
  }

  const pick = (re) => { const m = html.match(re); return m ? decodeEntities(m[1]) : null; };
  const all = (re) => [...html.matchAll(re)].map((m) => m[1]);
  const cleanTags = (s) => decodeEntities(String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));

  // ── text signals ──
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDesc = pick(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i)
    || pick(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)/i);
  const ogTitle = pick(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)/i);
  const headings = [
    ...all(/<h1[^>]*>([\s\S]*?)<\/h1>/gi),
    ...all(/<h2[^>]*>([\s\S]*?)<\/h2>/gi),
    ...all(/<h3[^>]*>([\s\S]*?)<\/h3>/gi),
  ].map(cleanTags).filter((s) => s && s.length > 1).slice(0, 20);

  // ── images (logo candidates + products) ──
  const imgSrcs = [...new Set(all(/<img[^>]*\bsrc=["']([^"']+)["']/gi))]
    .map((s) => absolutize(s, finalUrl)).filter(Boolean);
  const favicon = all(/<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)/gi)
    .map((s) => absolutize(s, finalUrl)).filter(Boolean);
  const ogImage = absolutize(pick(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)/i), finalUrl);

  const logoCandidates = [...new Set([
    ...imgSrcs.filter((s) => /logo/i.test(s)),
    ...favicon,
    ...(ogImage ? [ogImage] : []),
  ])].slice(0, 6);

  // product images: heuristic — not logos/icons/badges, reasonable file
  const productImages = imgSrcs.filter((s) =>
    !/logo|favicon|icon|sirim|badge|sprite|placeholder|avatar|payment|shopee|lazada/i.test(s)
    && /\.(png|jpe?g|webp)(\?|$)/i.test(s)
  ).slice(0, 24);

  // ── colours ──
  const themeColor = pick(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)/i);
  const hexTally = {};
  for (const m of html.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const h = '#' + m[1].toUpperCase();
    hexTally[h] = (hexTally[h] || 0) + 1;
  }
  const topColors = Object.entries(hexTally)
    .filter(([h]) => !/^#(FFFFFF|000000|FFF|FEFEFE)$/i.test(h))
    .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([hex, count]) => ({ hex, count }));

  // brand colour guess: most saturated (least grey) among the frequent hints —
  // greys/near-white dominate counts but a brand accent is a saturated hue.
  const saturation = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx === 0 ? 0 : (mx - mn) / mx;
  };
  const brandColorGuess = [...topColors].sort((a, b) => saturation(b.hex) - saturation(a.hex))
    .find((c) => saturation(c.hex) > 0.25)?.hex || (topColors[0] && topColors[0].hex) || null;

  // ── fonts ──
  const fonts = [...new Set(
    [...html.matchAll(/font-family:\s*([^;"'}<]+)/gi)].map((m) => m[1].trim())
  )].filter(Boolean).slice(0, 6);
  const googleFonts = [...new Set(
    all(/fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/gi).map((s) => decodeURIComponent(s).replace(/\+/g, ' '))
  )].slice(0, 5);

  // ── social ──
  const social = {};
  for (const [k, re] of Object.entries({
    facebook: /href=["'](https?:\/\/[^"']*facebook\.com\/[^"']+)/i,
    instagram: /href=["'](https?:\/\/[^"']*instagram\.com\/[^"']+)/i,
    tiktok: /href=["'](https?:\/\/[^"']*tiktok\.com\/[^"']+)/i,
    youtube: /href=["'](https?:\/\/[^"']*youtube\.com\/[^"']+)/i,
  })) {
    const m = html.match(re);
    if (m) social[k] = m[1];
  }

  // brand name guess: og:site_name → title before separator
  const siteName = pick(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)/i);
  const brandNameGuess = siteName
    || (title ? title.split(/[|\-–—:]/)[0].trim() : null);

  return {
    ok: true,
    url: finalUrl,
    brand_name_guess: brandNameGuess,
    title,
    tagline_guess: ogTitle && ogTitle !== title ? ogTitle : metaDesc,
    meta_description: metaDesc,
    headings,
    text_samples: [title, metaDesc, ...headings].filter(Boolean).slice(0, 15),
    logo_candidates: logoCandidates,
    product_images: productImages,
    brand_color_guess: brandColorGuess,
    color_hints: { theme_color: themeColor || null, top_colors: topColors },
    fonts: { css: fonts, google: googleFonts },
    social,
  };
}

module.exports = { analyzeWebsite, BROWSER_UA };
