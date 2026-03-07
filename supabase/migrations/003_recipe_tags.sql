-- Migration 003: Add protein and timing tags to recipes
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/yrkezxanaugjsdhngusa/sql

alter table recipes add column if not exists protein text;
alter table recipes add column if not exists timing text check (timing in ('weekday', 'weekend'));

-- Auto-tag protein from title
update recipes set protein = 'chicken' where lower(title) like '%chicken%' and protein is null;
update recipes set protein = 'salmon'  where lower(title) like '%salmon%'  and protein is null;
update recipes set protein = 'shrimp'  where lower(title) like '%shrimp%'  and protein is null;
update recipes set protein = 'lamb'    where lower(title) like '%lamb%'     and protein is null;
update recipes set protein = 'tofu'    where lower(title) like '%tofu%'     and protein is null;
update recipes set protein = 'beef'    where lower(title) like '%beef%'     and protein is null;
update recipes set protein = 'pork'    where lower(title) like '%pork%'     and protein is null;
update recipes set protein = 'pork'    where lower(title) like '%sausage%'  and protein is null;

-- Manual overrides for veggie dishes
update recipes set protein = 'veggie' where title in (
  'Magical Kale Salad',
  'Quick Vegetarian Fried Rice',
  'Parmesan Zucchini Fries with Tzatziki',
  'Lemony Orzo with Asparagus',
  'Caramelized Shallot Pasta',
  'Shallot Pasta',
  'Orange Pasta',
  'Miso Mushroom and Leek Pasta',
  'Creamy Miso Pasta',
  'Ricotta Pasta alla Vodka',
  'Summer Pasta with Zucchini and Ricotta',
  'Tomato Potato Soup',
  'Luo Song Tang (Red Vegetable Soup)',
  'Miso Mushroom Barley Soup',
  'Somen Noodle Soup with Mushrooms',
  'Broccoli and Celery Soup',
  'Lentil Tomato Soup',
  'Kale Salad with Apples and Cheddar',
  'Kale and Brussels Sprouts Salad',
  'Corn Salad with Mango and Halloumi',
  'Melon Salad with Nectarines and Tomatoes',
  'Tomato Cucumber and Corn Salad',
  'Roasted Broccolini with Lemon and Parmesan',
  'Roasted Carrots with Shallots and Mozzarella',
  'Honeynut Squash',
  'Sweet Potato Sandwich with Pesto and Kale',
  'Broccoli Tofu Bowls',
  'Peanut Tofu Bowls',
  'Sheet Pan Eggplant Tofu with Miso',
  'Egg Fried Rice',
  'Fried Rice'
);

-- Auto-tag timing: weekday = quick, weekend = more involved
update recipes set timing = 'weekday' where title in (
  'Sticky Miso Salmon Bowl',
  'Citrus Soy Chicken Ramen',
  'Honey Garlic Shrimp',
  'Shrimp Fried Rice',
  'Honey Garlic Salmon',
  'Maple Miso Sheet Pan Salmon',
  'Hoisin Garlic Noodles',
  'Caramelized Shallot Pasta',
  'Shallot Pasta',
  'Orange Pasta',
  'Spicy Tofu Noodles',
  'Egg Fried Rice',
  'Fried Rice',
  'Quick Vegetarian Fried Rice',
  'WPTN (White People Taco Night)',
  'Bibimbap',
  'Dumplings + Edamame',
  'Udon Chicken Mushroom Soup',
  'Tomato Potato Soup',
  'Japanese Curry Udon',
  'Tomato Basil Chicken Breasts',
  'Roasted Broccolini with Lemon and Parmesan',
  'Roasted Salmon with Miso Rice',
  'Sheet Pan Sausage with Peppers and Tomatoes',
  'Miso Honey Chicken and Asparagus',
  'Sesame Tofu with Broccoli',
  'Peanut Tofu Bowls',
  'Chicken Quesadillas with Avocado Cucumber Salsa',
  'Courgette Shrimp Pasta',
  'Tofu and Beef Bowl',
  'Sesame Ginger Soba',
  'Creamy Miso Pasta'
);

update recipes set timing = 'weekend' where title in (
  'Chinese Chicken Dumplings',
  'Chicken Tagine with Olives and Preserved Lemons',
  'Glazed Lamb Meatballs with Golden Raisins',
  'Japanese Curry Chicken Pot Pie',
  'Huli Huli Chicken',
  'Huli Huli Chicken (alt)',
  'Singapore Noodles (Mei Fun)',
  'Singapore Mei Fun (NYT)',
  'Chicken Enchiladas',
  'Luo Song Tang (Red Vegetable Soup)',
  'Rice Cake Soup with Bok Choy',
  'Cheesy Potato Breakfast Tacos',
  'Quiche with Red Peppers and Spinach',
  'Hawaiian Macaroni Salad',
  'Pajeon (Korean Scallion Pancake)',
  'Spiced Lamb Meatballs with Yogurt',
  'Chicken Koftas with Lime Couscous',
  'Gochujang Caramel Cookies',
  'Matcha Black Sesame Shortbreads',
  'Melon Salad with Nectarines and Tomatoes'
);
