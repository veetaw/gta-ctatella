-- GTA Ctatella: profilo unico, progressi e classifiche.
-- Eseguire nel SQL Editor di Supabase. La migrazione è ripetibile.
create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  procession_done boolean not null default false,
  procession_meters double precision not null default 0 check (procession_meters >= 0),
  unlocked_heli boolean not null default false,
  unlocked_ferrari boolean not null default false,
  throws_count integer check (throws_count > 0),
  best_distance_m double precision not null default 0,
  turneia_points integer not null default 0,
  turneia_completed boolean not null default false,
  abballa_points integer not null default 0,
  abballa_max_combo integer not null default 0,
  abballa_completed boolean not null default false,
  total_points bigint generated always as (
    (case when procession_done then 1000 else 0 end)
    + (case when throws_count is not null then greatest(100, 3000 - throws_count * 100) + round(best_distance_m)::bigint else 0 end)
    + turneia_points + abballa_points
  ) stored,
  updated_at timestamptz not null default now()
);
-- Classifica unica per reputazione.
alter table public.player_profiles add column if not exists rp integer not null default 0 check (rp >= 0);
create index if not exists player_profiles_rp_idx on public.player_profiles (rp desc);
create unique index if not exists player_profiles_username_unique on public.player_profiles (lower(username));
alter table public.player_profiles enable row level security;
drop policy if exists "Profiles public leaderboard" on public.player_profiles;
create policy "Profiles public leaderboard" on public.player_profiles for select using (true);
drop policy if exists "Profiles owner insert" on public.player_profiles;
create policy "Profiles owner insert" on public.player_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Profiles owner update" on public.player_profiles;
create policy "Profiles owner update" on public.player_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select on public.player_profiles to anon, authenticated;
grant insert, update on public.player_profiles to authenticated;

create or replace function public.game_profile_keep_best() returns trigger language plpgsql set search_path = public as $$
begin
  new.user_id := old.user_id;
  new.username := old.username;
  new.procession_meters := greatest(old.procession_meters, new.procession_meters);
  new.procession_done := old.procession_done or new.procession_done or new.procession_meters >= 15;
  new.unlocked_heli := old.unlocked_heli or new.unlocked_heli;
  new.unlocked_ferrari := old.unlocked_ferrari or new.unlocked_ferrari;
  new.rp := greatest(old.rp, new.rp);
  new.turneia_completed := old.turneia_completed or new.turneia_completed;
  new.turneia_points := greatest(old.turneia_points, new.turneia_points);
  new.abballa_completed := old.abballa_completed or new.abballa_completed;
  if old.throws_count is not null and (new.throws_count is null or old.throws_count < new.throws_count or (old.throws_count = new.throws_count and old.best_distance_m > new.best_distance_m)) then
    new.throws_count := old.throws_count;
    new.best_distance_m := old.best_distance_m;
  end if;
  if old.abballa_points > new.abballa_points or (old.abballa_points = new.abballa_points and old.abballa_max_combo > new.abballa_max_combo) then
    new.abballa_points := old.abballa_points;
    new.abballa_max_combo := old.abballa_max_combo;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists game_profile_keep_best on public.player_profiles;
create trigger game_profile_keep_best before update on public.player_profiles for each row execute function public.game_profile_keep_best();

create or replace function public.game_create_profile() returns trigger language plpgsql security definer set search_path = public as $$
declare nickname text := trim(coalesce(new.raw_user_meta_data ->> 'username', ''));
begin
  if nickname !~ '^[A-Za-z0-9_]{3,24}$' then
    raise exception 'Nickname: usa 3–24 lettere, numeri o underscore';
  end if;
  insert into public.player_profiles(user_id, username) values(new.id, nickname);
  return new;
exception when unique_violation then
  raise exception 'Nickname già utilizzato. Scegline un altro.';
end;
$$;
drop trigger if exists game_create_profile on auth.users;
create trigger game_create_profile after insert on auth.users for each row execute function public.game_create_profile();

-- Gli utenti precedenti ricevono un nickname distinto, senza perdere l'accesso.
insert into public.player_profiles(user_id, username)
select id, left(coalesce(nullif(regexp_replace(raw_user_meta_data ->> 'username', '[^A-Za-z0-9_]', '', 'g'), ''), 'Gregorese'), 17) || '_' || left(id::text, 6)
from auth.users on conflict (user_id) do nothing;

-- Mantiene anche le eventuali vecchie tabelle: nessuna cancellazione.
-- Adatta i nomi delle colonne solo se una precedente installazione li differenzia.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'player_profiles') then
    alter publication supabase_realtime add table public.player_profiles;
  end if;
end;
$$;
