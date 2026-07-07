// ============================================
// url-guard.js — SSRF 防护：安全抓取用户提供的任意 URL
//
// 品牌分析器和资产导入都会在服务端 fetch 用户给的网址。产品化后这是公开
// 输入，必须防 SSRF：只允许 http/https；解析后的 IP 不能落在私有/环回/
// 链路本地段（云元数据 169.254.169.254、127.0.0.1、内网等）；手动跟随
// 跳转并对每一跳重新校验（防 302 跳内网绕过）。
// ============================================

const dns = require('node:dns/promises');
const net = require('node:net');

// [网络地址, 前缀长度]
const BLOCKED_V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['255.255.255.255', 32],
];

function v4ToInt(ip) {
  return ip.split('.').reduce((acc, o) => (acc << 8) + (parseInt(o, 10) & 255), 0) >>> 0;
}

function isPrivateV4(ip) {
  const n = v4ToInt(ip);
  return BLOCKED_V4.some(([net_, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & mask) === (v4ToInt(net_) & mask);
  });
}

function isPrivateIP(ip) {
  if (net.isIPv4(ip)) return isPrivateV4(ip);
  // IPv6: loopback, unique-local (fc00::/7), link-local (fe80::/10),
  // and v4-mapped (::ffff:a.b.c.d) → check embedded v4
  const low = ip.toLowerCase();
  if (low === '::1' || low === '::') return true;
  if (/^f[cd][0-9a-f]{2}:/.test(low)) return true;   // fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(low)) return true;   // fe80::/10
  const mapped = low.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]);
  return false;
}

/**
 * Validate a URL is a public http(s) endpoint. Resolves DNS and rejects
 * private/link-local targets. Returns the resolved IP so callers can pin it.
 * @returns {Promise<{url: URL, ip: string}>}
 */
async function assertPublicHttpUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('Invalid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }
  let ip;
  if (net.isIP(u.hostname)) {
    ip = u.hostname;
  } else {
    const { address } = await dns.lookup(u.hostname);
    ip = address;
  }
  if (isPrivateIP(ip)) throw new Error('That address is not allowed');
  return { url: u, ip };
}

/**
 * SSRF-safe fetch: validates the initial URL and every redirect hop against
 * the private-range blocklist. redirect:'manual' so we control each hop.
 *
 * @param {string} raw
 * @param {object} [opts] - fetch options (headers, signal…). `redirect` ignored.
 * @param {number} [maxRedirects=4]
 */
async function safeFetch(raw, opts = {}, maxRedirects = 4) {
  let current = raw;
  for (let i = 0; i <= maxRedirects; i++) {
    const { url } = await assertPublicHttpUrl(current);
    const res = await fetch(url.href, { ...opts, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), url).href;
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects');
}

module.exports = { assertPublicHttpUrl, safeFetch, isPrivateIP };
