-- 006_shopping_organize.sql
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/yrkezxanaugjsdhngusa/sql

-- Add position and category to support organized shopping list
alter table shopping_items add column if not exists position integer;
alter table shopping_items add column if not exists category text;
