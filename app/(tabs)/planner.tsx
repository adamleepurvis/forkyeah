import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import type { Recipe, MealPlan } from '../../lib/types';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekDates(offset = 0): Date[] {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// Build a week: 1 fish, 1 chicken, 2 wildcard (no beef/lamb)
// Returns 4 picks for Mon–Thu in shuffled order
function buildWeekPicks(recipes: Recipe[]): Recipe[] {
  const fish = shuffle(recipes.filter((r) => r.protein === 'salmon' || r.protein === 'shrimp'));
  const chicken = shuffle(recipes.filter((r) => r.protein === 'chicken'));
  const wildcard = shuffle(recipes.filter((r) => r.protein !== 'beef' && r.protein !== 'lamb'));

  const picks: Recipe[] = [];
  const usedIds = new Set<string>();

  function pick(pool: Recipe[]): Recipe | null {
    return pool.find((r) => !usedIds.has(r.id)) ?? null;
  }

  const fishPick = pick(fish);
  if (fishPick) { picks.push(fishPick); usedIds.add(fishPick.id); }

  const chickenPick = pick(chicken);
  if (chickenPick) { picks.push(chickenPick); usedIds.add(chickenPick.id); }

  // Fill remaining slots (up to 4 total) with wildcards
  while (picks.length < 4) {
    const w = pick(wildcard);
    if (!w) break;
    picks.push(w);
    usedIds.add(w.id);
  }

  return shuffle(picks);
}

const PROTEIN_LABEL: Record<string, string> = {
  chicken: 'Chicken', salmon: 'Salmon', shrimp: 'Shrimp',
  beef: 'Beef', pork: 'Pork', lamb: 'Lamb', tofu: 'Tofu', veggie: 'Veggie',
};

export default function PlannerScreen() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekDates, setWeekDates] = useState<Date[]>(getWeekDates(0));
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);
  const [buildOpen, setBuildOpen] = useState(false);
  const [buildPicks, setBuildPicks] = useState<{ date: Date; recipe: Recipe }[]>([]);

  const fetchData = useCallback(async () => {
    const dates = getWeekDates(weekOffset);
    setWeekDates(dates);
    const start = toDateStr(dates[0]);
    const end = toDateStr(dates[6]);

    const [plansRes, recipesRes] = await Promise.all([
      supabase.from('meal_plans').select('*, recipe:recipes(*)').gte('date', start).lte('date', end).eq('meal_slot', 'dinner'),
      supabase.from('recipes').select('*').order('title'),
    ]);

    if (plansRes.error) Alert.alert('Error', plansRes.error.message);
    else setMealPlans(plansRes.data ?? []);

    if (recipesRes.error) Alert.alert('Error', recipesRes.error.message);
    else setRecipes(recipesRes.data ?? []);

    setLoading(false);
  }, [weekOffset]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]));

  function getMealPlan(date: string): MealPlan | undefined {
    return mealPlans.find((m) => m.date === date);
  }

  async function assignRecipe(recipe: Recipe) {
    if (!picking) return;
    const existing = getMealPlan(picking);
    if (existing) {
      await supabase.from('meal_plans').update({ recipe_id: recipe.id }).eq('id', existing.id);
    } else {
      await supabase.from('meal_plans').insert({ date: picking, meal_slot: 'dinner', recipe_id: recipe.id });
    }
    setPicking(null);
    fetchData();
  }

  async function clearSlot(date: string) {
    const existing = getMealPlan(date);
    if (!existing) return;
    await supabase.from('meal_plans').delete().eq('id', existing.id);
    fetchData();
  }

  function openBuildWeek() {
    const monThu = weekDates.slice(0, 4);
    const picks = buildWeekPicks(recipes);
    setBuildPicks(monThu.map((date, i) => ({ date, recipe: picks[i] })).filter((p) => p.recipe));
    setBuildOpen(true);
  }

  function regenerate() {
    const monThu = weekDates.slice(0, 4);
    const picks = buildWeekPicks(recipes);
    setBuildPicks(monThu.map((date, i) => ({ date, recipe: picks[i] })).filter((p) => p.recipe));
  }

  async function applyBuildWeek() {
    setBuildOpen(false);
    for (const { date, recipe } of buildPicks) {
      const dateStr = toDateStr(date);
      const existing = getMealPlan(dateStr);
      if (existing) {
        await supabase.from('meal_plans').update({ recipe_id: recipe.id }).eq('id', existing.id);
      } else {
        await supabase.from('meal_plans').insert({ date: dateStr, meal_slot: 'dinner', recipe_id: recipe.id });
      }
    }
    fetchData();
  }

  // Variety nudge: protein counts for the current week
  const proteinCounts: Record<string, number> = {};
  for (const plan of mealPlans) {
    const p = plan.recipe?.protein;
    if (p) proteinCounts[p] = (proteinCounts[p] || 0) + 1;
  }
  const proteinEntries = Object.entries(proteinCounts);

  const weekLabel = weekDates.length
    ? `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : '';

  return (
    <View style={styles.container}>
      {/* Week nav */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => setWeekOffset((o) => o - 1)} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color="#CC0000" />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
        <TouchableOpacity onPress={() => setWeekOffset((o) => o + 1)} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color="#CC0000" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.buildBtn} onPress={openBuildWeek}>
          <Ionicons name="sparkles-outline" size={18} color="#CC0000" />
        </TouchableOpacity>
      </View>

      {/* Variety nudge */}
      {proteinEntries.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.varietyRow} contentContainerStyle={styles.varietyContent}>
          {proteinEntries.map(([protein, count]) => {
            const warn = count >= 2;
            return (
              <View key={protein} style={[styles.varietyChip, warn && styles.varietyChipWarn]}>
                {warn && <Ionicons name="warning-outline" size={12} color="#CC0000" style={{ marginRight: 3 }} />}
                <Text style={[styles.varietyText, warn && styles.varietyTextWarn]}>
                  {PROTEIN_LABEL[protein] ?? protein}{count > 1 ? ` ×${count}` : ''}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#CC0000" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {weekDates.map((date, i) => {
            const dateStr = toDateStr(date);
            const isToday = toDateStr(new Date()) === dateStr;
            const plan = getMealPlan(dateStr);

            return (
              <View key={dateStr} style={[styles.dayCard, isToday && styles.dayCardToday]}>
                <View style={styles.dayHeader}>
                  <Text style={[styles.dayName, isToday && styles.dayNameToday]}>{DAY_NAMES[i]}</Text>
                  <Text style={[styles.dayDate, isToday && styles.dayDateToday]}>
                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>

                {plan?.recipe ? (
                  <TouchableOpacity
                    style={styles.assignedRecipe}
                    onPress={() => setPicking(dateStr)}
                    onLongPress={() => clearSlot(dateStr)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.assignedTitle}>{plan.recipe.title}</Text>
                    <Text style={styles.assignedHint}>Tap to change · Hold to clear</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.emptySlot} onPress={() => setPicking(dateStr)}>
                    <Ionicons name="add-circle-outline" size={22} color="#E8E0D8" />
                    <Text style={styles.emptySlotText}>Add dinner</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Recipe picker modal */}
      <Modal visible={!!picking} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pick a Recipe</Text>
            <TouchableOpacity onPress={() => setPicking(null)}>
              <Ionicons name="close" size={26} color="#1A1A2E" />
            </TouchableOpacity>
          </View>
          {recipes.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No recipes yet. Add some in the Recipes tab!</Text>
            </View>
          ) : (
            <FlatList
              data={recipes}
              keyExtractor={(r) => r.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.recipeOption} onPress={() => assignRecipe(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipeOptionText}>{item.title}</Text>
                    {item.protein && (
                      <Text style={styles.recipeOptionSub}>{PROTEIN_LABEL[item.protein]}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#ccc" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>

      {/* Build a week modal */}
      <Modal visible={buildOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Build This Week</Text>
            <TouchableOpacity onPress={() => setBuildOpen(false)}>
              <Ionicons name="close" size={26} color="#1A1A2E" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.buildContent}>
            <Text style={styles.buildSubtitle}>1 fish · 1 chicken · 2 wildcards, shuffled across Mon–Thu</Text>

            {buildPicks.map(({ date, recipe }, i) => (
              <View key={i} style={styles.buildRow}>
                <Text style={styles.buildDay}>{DAY_NAMES[weekDates.indexOf(date)]}</Text>
                <View style={styles.buildRecipeCard}>
                  <Text style={styles.buildRecipeTitle}>{recipe.title}</Text>
                  {recipe.protein && (
                    <Text style={styles.buildRecipeProtein}>{PROTEIN_LABEL[recipe.protein]}</Text>
                  )}
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.regenerateBtn} onPress={regenerate}>
              <Ionicons name="refresh-outline" size={18} color="#CC0000" />
              <Text style={styles.regenerateText}>Shuffle again</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.buildFooter}>
            <TouchableOpacity style={styles.clearBtn} onPress={() => setBuildOpen(false)}>
              <Text style={styles.clearBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={applyBuildWeek}>
              <Text style={styles.applyBtnText}>Apply Week</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F3' },
  weekNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#E8E0D8',
  },
  navBtn: { padding: 8 },
  weekLabel: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', flex: 1, textAlign: 'center' },
  buildBtn: { padding: 8 },
  varietyRow: { borderBottomWidth: 1, borderBottomColor: '#F0E8E0', maxHeight: 44 },
  varietyContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 6, flexDirection: 'row' },
  varietyChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  varietyChipWarn: { backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#FFCCCC' },
  varietyText: { fontSize: 12, color: '#888', fontWeight: '600' },
  varietyTextWarn: { color: '#CC0000' },
  grid: { padding: 16, gap: 12 },
  dayCard: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#E8E0D8', overflow: 'hidden',
  },
  dayCardToday: { borderColor: '#CC0000', borderWidth: 2 },
  dayHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0E8E0',
  },
  dayName: { fontSize: 15, fontWeight: '800', color: '#1A1A2E', width: 36 },
  dayNameToday: { color: '#CC0000' },
  dayDate: { fontSize: 14, color: '#999' },
  dayDateToday: { color: '#CC0000' },
  assignedRecipe: { padding: 16 },
  assignedTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  assignedHint: { fontSize: 11, color: '#ccc', marginTop: 4 },
  emptySlot: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 },
  emptySlotText: { fontSize: 15, color: '#ccc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 16, color: '#888', textAlign: 'center' },
  modal: { flex: 1, backgroundColor: '#FFF8F3' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: '#E8E0D8',
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  recipeOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#E8E0D8',
  },
  recipeOptionText: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  recipeOptionSub: { fontSize: 12, color: '#aaa', marginTop: 2 },
  // Build a week
  buildContent: { padding: 20, paddingBottom: 40 },
  buildSubtitle: { fontSize: 13, color: '#aaa', marginBottom: 20 },
  buildRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  buildDay: { fontSize: 14, fontWeight: '800', color: '#888', width: 36 },
  buildRecipeCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: '#E8E0D8',
  },
  buildRecipeTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  buildRecipeProtein: { fontSize: 12, color: '#CC0000', fontWeight: '600', marginTop: 3 },
  regenerateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 20, paddingVertical: 12,
  },
  regenerateText: { fontSize: 15, color: '#CC0000', fontWeight: '600' },
  buildFooter: {
    flexDirection: 'row', gap: 12, padding: 20,
    borderTopWidth: 1, borderTopColor: '#E8E0D8',
  },
  clearBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#E8E0D8',
  },
  clearBtnText: { fontSize: 16, color: '#888', fontWeight: '600' },
  applyBtn: { flex: 2, backgroundColor: '#CC0000', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  applyBtnText: { fontSize: 16, color: '#fff', fontWeight: '700' },
});
