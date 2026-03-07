export type Recipe = {
  id: string;
  title: string;
  url: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type MealPlan = {
  id: string;
  date: string; // YYYY-MM-DD
  meal_slot: 'dinner';
  recipe_id: string | null;
  recipe?: Recipe;
};

export type ShoppingItem = {
  id: string;
  name: string;
  checked: boolean;
  created_at: string;
};
