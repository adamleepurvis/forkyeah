-- Add free-text note field to meal_plans for entries without a linked recipe
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS note text;
