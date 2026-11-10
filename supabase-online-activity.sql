-- Run once in the Supabase SQL Editor.
create table if not exists public.online_room_activity (
  hour_start timestamptz not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (hour_start, user_id)
);

alter table public.online_room_activity enable row level security;
revoke all on table public.online_room_activity from public, anon, authenticated;

create or replace function public.record_online_room_join()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.online_room_activity (hour_start, user_id)
  select date_trunc('hour', now(), 'UTC'), auth.uid()
  where auth.uid() is not null
  on conflict (hour_start, user_id) do nothing;
$$;

revoke all on function public.record_online_room_join() from public, anon, authenticated;
grant execute on function public.record_online_room_join() to authenticated;

-- Run this query tomorrow to count distinct accounts from 22:00 to 08:00 Rome time.
-- select count(distinct user_id) as giocatori_unici
-- from public.online_room_activity
-- where hour_start >= timestamp '2026-11-10 22:00' at time zone 'Europe/Rome'
--   and hour_start <  timestamp '2026-11-11 08:00' at time zone 'Europe/Rome';
