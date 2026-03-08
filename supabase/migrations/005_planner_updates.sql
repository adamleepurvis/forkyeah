-- 005_planner_updates.sql
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/yrkezxanaugjsdhngusa/sql

-- 1. Allow multiple recipes per day (drop unique constraint)
alter table meal_plans drop constraint if exists meal_plans_date_meal_slot_key;

-- 2. Add position for ordering multiple recipes per day
alter table meal_plans add column if not exists position integer not null default 0;

-- 3. Day specials: per-date label overrides (day-of-week defaults handled in app)
create table if not exists day_specials (
  date date primary key,
  label text not null default ''
);

alter table day_specials enable row level security;

create policy "Auth users read day_specials"
  on day_specials for select to authenticated using (true);
create policy "Auth users insert day_specials"
  on day_specials for insert to authenticated with check (true);
create policy "Auth users update day_specials"
  on day_specials for update to authenticated using (true);
create policy "Auth users delete day_specials"
  on day_specials for delete to authenticated using (true);
