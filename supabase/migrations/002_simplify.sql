-- Migration 002: Simplify recipes, add manual shopping list
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/yrkezxanaugjsdhngusa/sql

-- Update recipes table: swap ingredients/steps for a url field
alter table recipes drop column if exists ingredients;
alter table recipes drop column if exists steps;
alter table recipes add column if not exists url text;

-- Manual shopping list (persistent, shared between both users)
create table if not exists shopping_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  checked boolean default false,
  created_at timestamptz default now()
);

alter table shopping_items enable row level security;

create policy "Auth users read shopping_items"
  on shopping_items for select to authenticated using (true);
create policy "Auth users insert shopping_items"
  on shopping_items for insert to authenticated with check (true);
create policy "Auth users update shopping_items"
  on shopping_items for update to authenticated using (true);
create policy "Auth users delete shopping_items"
  on shopping_items for delete to authenticated using (true);
