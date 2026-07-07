import { NextResponse } from 'next/server';
import { analyzeWebsite } from '@/app/lib/brand-analyzer';

/**
 * Brand analyzer — POST { url } → structured brand signals extracted from the
 * website (text + logo/product images + colour hints + fonts + socials).
 * Brand-agnostic: no assumptions about the industry. Deterministic, no LLM.
 * The onboarding page presents these as an editable draft; the LLM voice/style
 * step is a separate route.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const url = (body.url || '').trim();
  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  try {
    const result = await analyzeWebsite(url);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Could not analyze the site' }, { status: 422 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('brand analyze failed:', err.message);
    const msg = err.name === 'AbortError' ? 'The site took too long to respond.' : 'Failed to fetch the site.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
