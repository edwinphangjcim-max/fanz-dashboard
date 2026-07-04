import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

export async function GET(request, { params }) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const { id } = await params;
  const planId = id;

  const { data: plan, error: planError } = await supabase
    .from('content_plans')
    .select('id, month, status, total_posts, notes, created_at')
    .eq('id', planId)
    .single();

  if (planError || !plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  }

  const { data: posts, error: postsError } = await supabase
    .from('content_calendar')
    .select('id, topic, pillar, fb_content, ig_content, hashtags, image_url, scene_image_url, status, suggested_date, review_notes, post_angle, image_status, image_source, scheduled_date, created_at')
    .eq('plan_id', planId)
    .order('suggested_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (postsError) {
    console.error('Failed to fetch plan posts:', postsError.message);
    return NextResponse.json({ error: 'Failed to fetch plan posts.' }, { status: 500 });
  }

  return NextResponse.json({
    plan,
    posts: posts || [],
  });
}