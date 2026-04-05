-- Stored procedures for portfolio-blog email subscription
-- RPC interface layer: functions in public schema (required for RPC discovery)
-- All data stays in isolated portfolio_blog schema
-- Functions use "security definer" + explicit grants for defense-in-depth

-- Function: Subscribe (insert email + token)
create or replace function public.subscribe(p_email text, p_unsubscribe_token text)
returns json as $$
declare
  v_result json;
begin
  -- Check if already exists
  if exists(select 1 from portfolio_blog.subscribers where email = p_email) then
    return json_build_object('success', false, 'error', 'Already subscribed with this email');
  end if;

  -- Insert subscriber
  insert into portfolio_blog.subscribers (email, verified, unsubscribe_token)
  values (p_email, true, p_unsubscribe_token);

  return json_build_object('success', true, 'message', 'Subscribed! You will receive a digest of new posts every day at midnight UTC.');
exception when others then
  return json_build_object('success', false, 'error', 'Failed to subscribe: ' || sqlstate || ' ' || sqlerrm);
end;
$$ language plpgsql security definer set search_path = public, portfolio_blog;

-- Function: Unsubscribe (delete by token)
create or replace function public.unsubscribe(p_unsubscribe_token text)
returns json as $$
declare
  v_deleted_count int;
begin
  delete from portfolio_blog.subscribers where unsubscribe_token = p_unsubscribe_token;
  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    return json_build_object('success', false, 'error', 'Subscriber not found');
  end if;

  return json_build_object('success', true, 'message', 'You have been removed from the mailing list.');
exception when others then
  return json_build_object('success', false, 'error', 'Failed to unsubscribe: ' || sqlstate || ' ' || sqlerrm);
end;
$$ language plpgsql security definer set search_path = public, portfolio_blog;

-- Function: Get verified subscribers (for cron)
create or replace function public.get_verified_subscribers()
returns table(email text, unsubscribe_token text) as $$
  select email, unsubscribe_token from portfolio_blog.subscribers where verified = true;
$$ language sql security definer set search_path = public, portfolio_blog;

-- Function: Get last newsletter send timestamp
create or replace function public.get_last_newsletter_send()
returns timestamp with time zone as $$
  select sent_at from portfolio_blog.newsletter_sends order by sent_at desc limit 1;
$$ language sql security definer set search_path = public, portfolio_blog;

-- Function: Insert newsletter send audit log
create or replace function public.insert_newsletter_send(
  p_post_ids text,
  p_post_count int,
  p_sent_at timestamp with time zone,
  p_subscriber_count int,
  p_provider text,
  p_status text
)
returns json as $$
begin
  insert into portfolio_blog.newsletter_sends (post_ids, post_count, sent_at, subscriber_count, provider, status)
  values (p_post_ids, p_post_count, p_sent_at, p_subscriber_count, p_provider, p_status);

  return json_build_object('success', true, 'message', 'Newsletter send logged');
exception when others then
  return json_build_object('success', false, 'error', 'Failed to log send: ' || sqlstate || ' ' || sqlerrm);
end;
$$ language plpgsql security definer set search_path = public, portfolio_blog;

-- Grant execute permissions on functions to anon role (public signup) and authenticated role
grant execute on function public.subscribe(text, text) to anon, authenticated;
grant execute on function public.unsubscribe(text) to anon, authenticated;
grant execute on function public.get_verified_subscribers() to service_role;
grant execute on function public.get_last_newsletter_send() to service_role;
grant execute on function public.insert_newsletter_send(text, int, timestamp with time zone, int, text, text) to service_role;
