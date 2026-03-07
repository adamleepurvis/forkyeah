export type Ingredient = {
  amount: string;
  unit: string;
  name: string;
};

export type Recipe = {
  id: string;
  title: string;
  ingredients: Ingredient[];
  steps: string[];
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export type MealPlan = {
  id: string;
  date: string; // YYYY-MM-DD
  meal_slot: MealSlot;
  recipe_id: string | null;
  recipe?: Recipe;
};
