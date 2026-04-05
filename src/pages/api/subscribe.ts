import type { APIRoute } from 'astro';
import { getSupabaseClient } from '../../lib/db';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json();
    const email = body.email?.toLowerCase().trim();

    if (!email || !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = getSupabaseClient();

    // Check if already subscribed
    const { data: existing } = await db
      .from('subscribers')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Already subscribed with this email' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate unsubscribe token
    const token = crypto.getRandomValues(new Uint8Array(16)).reduce((acc, byte) => {
      return acc + byte.toString(16).padStart(2, '0');
    }, '');

    // Insert subscriber
    const { error } = await db.from('subscribers').insert({
      email,
      unsubscribe_token: token,
      verified: true,
    });

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to subscribe' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscribed! You will receive a digest of new posts every day at midnight UTC.',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Subscribe error:', error);
    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
