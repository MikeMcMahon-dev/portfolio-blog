import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getSupabaseClient } from '../../lib/db';
import { createEmailService } from '../../lib/email';
import { renderDigestAsHtml } from '../../lib/email-template';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const POST: APIRoute = async (context) => {
  try {
    // Verify cron secret
    const authHeader = context.request.headers.get('Authorization');
    const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = getSupabaseClient();

    // Get timestamp of last newsletter send
    const { data: lastSend } = await db
      .from('newsletter_sends')
      .select('sent_at')
      .order('sent_at', { ascending: false })
      .limit(1)
      .single();

    const sinceTimestamp = lastSend?.sent_at
      ? new Date(lastSend.sent_at)
      : new Date(Date.now() - SEVEN_DAYS_MS);

    console.log(`📧 Newsletter cron: checking for posts since ${sinceTimestamp.toISOString()}`);

    // Get all published posts since last send (not draft)
    const allPosts = await getCollection('blog');
    const newPosts = allPosts
      .filter((p) => !p.data.draft && new Date(p.data.pubDate) > sinceTimestamp)
      .sort((a, b) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime());

    if (newPosts.length === 0) {
      console.log('✅ No new posts since last send');
      return new Response(
        JSON.stringify({ success: true, message: 'No new posts since last send' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📧 Found ${newPosts.length} new post(s)`);

    // Get verified subscribers
    const { data: subscribers, error: subError } = await db
      .from('subscribers')
      .select('email, unsubscribe_token')
      .eq('verified', true);

    if (subError || !subscribers || subscribers.length === 0) {
      console.log('✅ No verified subscribers');
      return new Response(
        JSON.stringify({ success: true, message: 'No verified subscribers' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📧 Sending to ${subscribers.length} subscriber(s)`);

    // Render digest
    const html = renderDigestAsHtml(newPosts);

    // Build subject line
    const subject =
      newPosts.length === 1
        ? `New post: ${newPosts[0].data.title}`
        : `New posts: ${newPosts.length} new articles`;

    // Create email service
    const emailService = createEmailService();

    // Build unsubscribe token map
    const tokenMap = new Map<string, string>();
    for (const sub of subscribers) {
      tokenMap.set(sub.email, sub.unsubscribe_token);
    }

    // Send batch
    const sendResult = await emailService.sendBatch(
      subscribers.map((s) => s.email),
      subject,
      html,
      tokenMap
    );

    console.log(
      `📧 Send result: ${sendResult.sent} sent, ${sendResult.failed} failed`
    );

    // Log send event
    const { error: logError } = await db.from('newsletter_sends').insert({
      post_ids: newPosts.map((p) => p.id).join(','),
      post_count: newPosts.length,
      sent_at: new Date().toISOString(),
      subscriber_count: sendResult.sent,
      provider: process.env.EMAIL_PROVIDER || 'mock',
      status: sendResult.success ? 'sent' : 'failed',
    });

    if (logError) {
      console.error('Failed to log newsletter send:', logError);
    }

    return new Response(
      JSON.stringify({
        success: sendResult.success,
        sent: sendResult.sent,
        failed: sendResult.failed,
        posts: newPosts.length,
        provider: process.env.EMAIL_PROVIDER || 'mock',
      }),
      {
        status: sendResult.success ? 200 : 207,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Newsletter cron error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
