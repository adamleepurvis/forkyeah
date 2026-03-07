-- ForkYeah database schema
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/yrkezxanaugjsdhngusa/sql

-- ============================================================
-- RECIPES
-- ============================================================
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at on changes
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger recipes_updated_at
  before update on recipes
  for each row execute function update_updated_at();

-- ============================================================
-- MEAL PLANS
-- ============================================================
create table if not exists meal_plans (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'dinner')),
  recipe_id uuid references recipes(id) on delete set null,
  created_at timestamptz default now(),
  unique (date, meal_slot)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Any authenticated user (you or your wife) can read/write everything.
-- ============================================================
alter table recipes enable row level security;
alter table meal_plans enable row level security;

create policy "Auth users read recipes"
  on recipes for select to authenticated using (true);
create policy "Auth users insert recipes"
  on recipes for insert to authenticated with check (true);
create policy "Auth users update recipes"
  on recipes for update to authenticated using (true);
create policy "Auth users delete recipes"
  on recipes for delete to authenticated using (true);

create policy "Auth users read meal_plans"
  on meal_plans for select to authenticated using (true);
create policy "Auth users insert meal_plans"
  on meal_plans for insert to authenticated with check (true);
create policy "Auth users update meal_plans"
  on meal_plans for update to authenticated using (true);
create policy "Auth users delete meal_plans"
  on meal_plans for delete to authenticated using (true);
