import type { APIRoute } from 'astro';
import { getSupabaseClient } from '../../lib/db';

export const GET: APIRoute = async (context) => {
  try {
    const token = context.url.searchParams.get('token');

    if (!token) {
      return new Response('Token required', { status: 400 });
    }

    const db = getSupabaseClient();

    // Delete subscriber by token
    const { error } = await db
      .from('subscribers')
      .delete()
      .eq('unsubscribe_token', token);

    if (error) {
      console.error('Database error:', error);
      return new Response('Failed to unsubscribe', { status: 500 });
    }

    // Return simple confirmation
    return new Response(
      `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Unsubscribed</title>
    <style>
      body {
        font-family: system-ui, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        background: #f5f5f5;
      }
      .container {
        text-align: center;
        background: white;
        padding: 40px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(44, 44, 44, 0.08);
      }
      h1 {
        color: #333;
        margin: 0 0 10px 0;
      }
      p {
        color: #666;
        margin: 0;
      }
      a {
        color: #3D6B7D;
        text-decoration: none;
        margin-top: 20px;
        display: inline-block;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Unsubscribed</h1>
      <p>You have been removed from the mailing list.</p>
      <a href="https://mikemcmahon.dev">← Back to blog</a>
    </div>
  </body>
</html>
      `,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return new Response('Invalid request', { status: 400 });
  }
};
