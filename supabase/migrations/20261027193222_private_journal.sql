begin;
create table if not exists public.cinema_journal (
 user_id uuid not null references auth.users(id) on delete cascade,
 title_id text not null check (title_id ~ '^tt[0-9]{7,12}$'),
 status text not null default 'none' check (status in ('none','seen','watchlist')),
 rating smallint check (rating between 1 and 10),
 favorite boolean not null default false,
 watched_on date,
 note text not null default '' check (char_length(note) <= 2000),
 updated_at timestamptz not null default now(),
 primary key (user_id,title_id)
);
alter table public.cinema_journal enable row level security;
revoke all on public.cinema_journal from anon;
revoke all on public.cinema_journal from authenticated;
grant select, insert, update on public.cinema_journal to authenticated;
drop policy if exists cinema_read_own on public.cinema_journal;
create policy cinema_read_own on public.cinema_journal for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists cinema_insert_own on public.cinema_journal;
create policy cinema_insert_own on public.cinema_journal for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists cinema_update_own on public.cinema_journal;
create policy cinema_update_own on public.cinema_journal for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create or replace function public.cinema_touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists cinema_updated_at on public.cinema_journal;
create trigger cinema_updated_at before update on public.cinema_journal for each row execute function public.cinema_touch_updated_at();
commit;
