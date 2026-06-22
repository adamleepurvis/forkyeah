export type Protein = 'chicken' | 'salmon' | 'shrimp' | 'beef' | 'pork' | 'lamb' | 'tofu' | 'veggie';
export type Timing = 'weekday' | 'weekend';

export type Recipe = {
  id: string;
  title: string;
  url: string | null;
  notes: string | null;
  protein: Protein | null;
  timing: Timing | null;
  ingredients: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MealPlan = {
  id: string;
  date: string; // YYYY-MM-DD
  meal_slot: 'lunch' | 'dinner';
  recipe_id: string | null;
  recipe?: Recipe;
  position: number;
};

export type DaySpecial = {
  date: string; // YYYY-MM-DD
  label: string;
};

export type ShoppingItem = {
  id: string;
  name: string;
  checked: boolean;
  created_at: string;
  position: number | null;
  category: string | null;
};

export function getSource(url: string | null): string {
  if (!url) return 'No link';
  if (url.includes('nytimes.com')) return 'NYT Cooking';
  if (url.includes('thewoksoflife.com')) return 'Woks of Life';
  if (url.includes('daisybeet.com')) return 'Daisybeet';
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('bonappetit.com')) return 'Bon Appétit';
  if (url.includes('omnivorescookbook.com')) return "Omnivore's Cookbook";
  if (url.includes('loveandlemons.com')) return 'Love & Lemons';
  if (url.includes('foodandwine.com')) return 'Food & Wine';
  if (url.includes('maangchi.com')) return 'Maangchi';
  if (url.includes('favfamilyrecipes.com')) return 'Fav Family Recipes';
  if (url.includes('twopeasandtheirpod.com')) return 'Two Peas & Their Pod';
  if (url.includes('joyousapron.com')) return 'Joyous Apron';
  if (url.includes('whiteblankspace.com')) return 'White Blank Space';
  if (url.includes('cookingformysoul.com')) return 'Cooking for My Soul';
  if (url.includes('ottolenghi.co.uk')) return 'Ottolenghi';
  return 'Other';
}
