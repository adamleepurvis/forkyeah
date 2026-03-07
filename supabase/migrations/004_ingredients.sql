-- Migration 004: Add ingredients array to recipes
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/yrkezxanaugjsdhngusa/sql

alter table recipes add column if not exists ingredients text[] default '{}';
