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

    // Get timestamp of last newsletter send via stored procedure
    const { data: lastSendTimestamp, error: lastSendError } = await db.rpc('get_last_newsletter_send');

    if (lastSendError) {
      console.error('Error fetching last send timestamp:', lastSendError);
    }

    const sinceTimestamp = lastSendTimestamp
      ? new Date(lastSendTimestamp)
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

    // Get verified subscribers via stored procedure
    const { data: subscribers, error: subError } = await db.rpc('get_verified_subscribers');

    if (subError || !subscribers || subscribers.length === 0) {
      console.log('✅ No verified subscribers');
      return new Response(
        JSON.stringify({ success: true, message: 'No verified subscribers' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📧 Sending to ${subscribers.length} subscriber(s)`);

    // Build subject line
    const subject =
      newPosts.length === 1
        ? `New post: ${newPosts[0].data.title}`
        : `New posts: ${newPosts.length} new articles`;

    // Create email service
    const emailService = createEmailService();

    // Send to each subscriber with their unique token in the email body
    let sent = 0;
    let failed = 0;
    for (const subscriber of subscribers) {
      // Render digest with this subscriber's unique unsubscribe token
      const html = renderDigestAsHtml(newPosts, subscriber.unsubscribe_token);

      const result = await emailService.send(
        subscriber.email,
        subject,
        html,
        subscriber.unsubscribe_token
      );

      if (result.success) {
        sent++;
      } else {
        failed++;
        console.error(`Failed to send to ${subscriber.email}:`, result.error);
      }
    }

    const sendResult = {
      success: failed === 0,
      sent,
      failed,
    };

    console.log(
      `📧 Send result: ${sendResult.sent} sent, ${sendResult.failed} failed`
    );

    // Log send event via stored procedure
    const { error: logError } = await db.rpc('insert_newsletter_send', {
      p_post_ids: newPosts.map((p) => p.id).join(','),
      p_post_count: newPosts.length,
      p_sent_at: new Date().toISOString(),
      p_subscriber_count: sendResult.sent,
      p_provider: process.env.EMAIL_PROVIDER || 'mock',
      p_status: sendResult.success ? 'sent' : 'failed',
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
