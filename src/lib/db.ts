import { createClient } from '@supabase/supabase-js';

export type Subscriber = {
  id: string;
  email: string;
  created_at: string;
  verified: boolean;
  unsubscribe_token: string;
};

export type NewsletterSend = {
  id: string;
  post_ids: string;
  post_count: number;
  sent_at: string;
  subscriber_count: number;
  provider: string;
  status: 'sent' | 'failed';
};

export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient<{
    public: {
      Tables: {
        subscribers: {
          Row: Subscriber;
          Insert: Omit<Subscriber, 'id' | 'created_at'>;
          Update: Partial<Subscriber>;
        };
        newsletter_sends: {
          Row: NewsletterSend;
          Insert: Omit<NewsletterSend, 'id'>;
          Update: Partial<NewsletterSend>;
        };
      };
    };
  }>(url, key);
}
