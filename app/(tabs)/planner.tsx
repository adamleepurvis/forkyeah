import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, FlatList, Alert, ActivityIndicator, TextInput, Linking,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import type { Recipe, MealPlan } from '../../lib/types';
import { useColors, type Colors } from '../../lib/colors';

// Week starts Sunday
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Day-of-week defaults: 0 = Sunday, 5 = Friday
const DOW_DEFAULTS: Record<number, string> = { 0: 'Somos', 5: 'Order Out' };

function getWeekDates(offset = 0): Date[] {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Use noon to avoid DST day-shift issues
function getDOW(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00').getDay();
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

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
  const [weekOffset, setWeekOffset] = useState(() => new Date().getDay() === 6 ? 1 : 0);
  const [weekDates, setWeekDates] = useState<Date[]>(getWeekDates(0));
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [daySpecials, setDaySpecials] = useState<Record<string, string>>({});
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [buildOpen, setBuildOpen] = useState(false);
  const [buildPicks, setBuildPicks] = useState<{ date: Date; recipe: Recipe }[]>([]);
  const [specialModal, setSpecialModal] = useState<{ dateStr: string; value: string } | null>(null);
  const C = useColors();
  const styles = makeStyles(C);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    const dates = getWeekDates(weekOffset);
    setWeekDates(dates);
    const start = toDateStr(dates[0]);
    const end = toDateStr(dates[6]);

    const [plansRes, recipesRes, specialsRes] = await Promise.all([
      supabase
        .from('meal_plans')
        .select('*, recipe:recipes(*)')
        .gte('date', start)
        .lte('date', end)
        .order('position'),
      supabase.from('recipes').select('*').order('title'),
      supabase.from('day_specials').select('*').gte('date', start).lte('date', end),
    ]);

    if (plansRes.error) Alert.alert('Error', plansRes.error.message);
    else setMealPlans(plansRes.data ?? []);

    if (recipesRes.error) Alert.alert('Error', recipesRes.error.message);
    else setRecipes(recipesRes.data ?? []);

    if (!specialsRes.error) {
      const map: Record<string, string> = {};
      for (const s of specialsRes.data ?? []) map[s.date] = s.label;
      setDaySpecials(map);
    }

    setLoading(false);
  }, [weekOffset]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]));

  function getMealPlansForDate(dateStr: string): MealPlan[] {
    return mealPlans.filter((m) => m.date === dateStr).sort((a, b) => a.position - b.position);
  }

  function getSpecialForDate(dateStr: string): string {
    if (dateStr in daySpecials) return daySpecials[dateStr];
    return DOW_DEFAULTS[getDOW(dateStr)] ?? '';
  }

  function closePicker() {
    setPicking(null);
    setPickerSearch('');
  }

  async function addRecipeToDay(recipe: Recipe) {
    if (!picking) return;
    const existing = getMealPlansForDate(picking);
    const position = existing.length;
    await supabase
      .from('meal_plans')
      .insert({ date: picking, meal_slot: 'dinner', recipe_id: recipe.id, position });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPicking(null);
    fetchData();
  }

  async function removeRecipeFromDay(id: string) {
    await supabase.from('meal_plans').delete().eq('id', id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fetchData();
  }

  async function addIngredientsToShopping(plan: MealPlan) {
    const ingredients = plan.recipe?.ingredients;
    if (!ingredients?.length) {
      Alert.alert('No ingredients', 'This recipe has no ingredients saved. Edit it to add some.');
      return;
    }
    await supabase.from('shopping_items').insert(ingredients.map((name) => ({ name })));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function editSpecial(dateStr: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSpecialModal({ dateStr, value: getSpecialForDate(dateStr) });
  }

  async function saveSpecial() {
    if (!specialModal) return;
    const { dateStr, value } = specialModal;
    const label = value.trim();
    await supabase.from('day_specials').upsert({ date: dateStr, label }, { onConflict: 'date' });
    setDaySpecials((prev) => ({ ...prev, [dateStr]: label }));
    setSpecialModal(null);
  }

  function openBuildWeek() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Mon–Thu = indices 1–4 in Sun-based week; skip days with specials set
    const monThu = weekDates.slice(1, 5).filter((d) => !getSpecialForDate(toDateStr(d)));
    const picks = buildWeekPicks(recipes);
    setBuildPicks(monThu.map((date, i) => ({ date, recipe: picks[i] })).filter((p) => p.recipe));
    setBuildOpen(true);
  }

  function regenerate() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const monThu = weekDates.slice(1, 5).filter((d) => !getSpecialForDate(toDateStr(d)));
    const picks = buildWeekPicks(recipes);
    setBuildPicks(monThu.map((date, i) => ({ date, recipe: picks[i] })).filter((p) => p.recipe));
  }

  async function applyBuildWeek() {
    setBuildOpen(false);
    for (const { date, recipe } of buildPicks) {
      const dateStr = toDateStr(date);
      await supabase.from('meal_plans').delete().eq('date', dateStr);
      await supabase
        .from('meal_plans')
        .insert({ date: dateStr, meal_slot: 'dinner', recipe_id: recipe.id, position: 0 });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    fetchData();
  }

  // Count proteins across all recipes for all days
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
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => setWeekOffset((o) => o - 1)} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={C.red} />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
        <TouchableOpacity onPress={() => setWeekOffset((o) => o + 1)} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color={C.red} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.buildBtn} onPress={openBuildWeek}>
          <Ionicons name="sparkles-outline" size={18} color={C.red} />
        </TouchableOpacity>
      </View>

      {proteinEntries.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.varietyRow} contentContainerStyle={styles.varietyContent}>
          {proteinEntries.map(([protein, count]) => {
            const warn = count >= 2;
            return (
              <View key={protein} style={[styles.varietyChip, warn && styles.varietyChipWarn]}>
                {warn && <Ionicons name="warning-outline" size={12} color={C.red} style={{ marginRight: 3 }} />}
                <Text style={[styles.varietyText, warn && styles.varietyTextWarn]}>
                  {PROTEIN_LABEL[protein] ?? protein}{count > 1 ? ` ×${count}` : ''}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={C.red} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {weekDates.map((date, i) => {
            const dateStr = toDateStr(date);
            const isToday = toDateStr(new Date()) === dateStr;
            const plans = getMealPlansForDate(dateStr);
            const special = getSpecialForDate(dateStr);

            return (
              <View key={dateStr} style={[styles.dayCard, isToday && styles.dayCardToday]}>
                <View style={styles.dayHeader}>
                  <Text style={[styles.dayName, isToday && styles.dayNameToday]}>{DAY_NAMES[i]}</Text>
                  <Text style={[styles.dayDate, isToday && styles.dayDateToday]}>
                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                  <TouchableOpacity onPress={() => editSpecial(dateStr)} style={styles.specialEditBtn}>
                    {special ? (
                      <View style={styles.specialBadge}>
                        <Text style={styles.specialBadgeText}>{special}</Text>
                        <Ionicons name="pencil" size={10} color={C.red} style={{ marginLeft: 4 }} />
                      </View>
                    ) : (
                      <Ionicons name="flag-outline" size={16} color={C.border} />
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.dayBody}>
                  {plans.map((plan) => (
                    <View key={plan.id} style={styles.assignedRecipe}>
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => {
                          const url = plan.recipe?.url;
                          if (url) Linking.openURL(url);
                        }}
                        activeOpacity={plan.recipe?.url ? 0.6 : 1}
                      >
                        <Text style={styles.assignedTitle} numberOfLines={1}>{plan.recipe?.title}</Text>
                        {plan.recipe?.url && <Text style={styles.assignedLink}>Open recipe ↗</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => addIngredientsToShopping(plan)}
                        style={styles.recipeActionBtn}
                      >
                        <Ionicons name="cart-outline" size={16} color={C.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeRecipeFromDay(plan.id)}
                        style={styles.recipeActionBtn}
                      >
                        <Ionicons name="close-circle" size={18} color={C.border} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addSlot}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPicking(dateStr); }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={C.border} />
                    <Text style={styles.addSlotText}>{plans.length === 0 ? 'Add dinner' : 'Add another'}</Text>
                  </TouchableOpacity>
                </View>
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
            <TouchableOpacity onPress={closePicker}>
              <Ionicons name="close" size={26} color={C.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.pickerSearchWrap}>
            <Ionicons name="search" size={16} color={C.textMuted} style={styles.pickerSearchIcon} />
            <TextInput
              style={styles.pickerSearchInput}
              placeholder="Search recipes..."
              placeholderTextColor={C.placeholder}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
          {recipes.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No recipes yet.</Text>
            </View>
          ) : (
            <FlatList
              data={recipes.filter((r) =>
                r.title.toLowerCase().includes(pickerSearch.toLowerCase())
              )}
              keyExtractor={(r) => r.id}
              contentContainerStyle={{ padding: 16 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.emptyText}>No recipes match "{pickerSearch}"</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.recipeOption} onPress={() => addRecipeToDay(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipeOptionText}>{item.title}</Text>
                    {item.protein && <Text style={styles.recipeOptionSub}>{PROTEIN_LABEL[item.protein]}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.border} />
                </TouchableOpacity>
              )}
            />
          )}
          <View style={styles.pickerFooter}>
            <TouchableOpacity
              style={styles.addNewRecipeBtn}
              onPress={() => { closePicker(); router.push('/(tabs)/recipes/new'); }}
            >
              <Ionicons name="add-circle-outline" size={18} color={C.red} />
              <Text style={styles.addNewRecipeText}>Add a new recipe</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Special label modal */}
      <Modal visible={!!specialModal} animationType="fade" transparent>
        <View style={styles.specialOverlay}>
          <View style={styles.specialSheet}>
            <Text style={styles.specialSheetTitle}>Day Special</Text>
            <Text style={styles.specialSheetSub}>e.g. "Order Out", "Somos" — leave empty to clear</Text>
            <TextInput
              style={styles.specialSheetInput}
              value={specialModal?.value ?? ''}
              onChangeText={(v) => setSpecialModal((prev) => prev ? { ...prev, value: v } : prev)}
              placeholder="Special label..."
              placeholderTextColor={C.placeholder}
              autoFocus
              onSubmitEditing={saveSpecial}
            />
            <View style={styles.specialSheetBtns}>
              <TouchableOpacity style={styles.specialCancelBtn} onPress={() => setSpecialModal(null)}>
                <Text style={styles.specialCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.specialSaveBtn} onPress={saveSpecial}>
                <Text style={styles.specialSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Build a week modal */}
      <Modal visible={buildOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Build This Week</Text>
            <TouchableOpacity onPress={() => setBuildOpen(false)}>
              <Ionicons name="close" size={26} color={C.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.buildContent}>
            <Text style={styles.buildSubtitle}>
              1 fish · 1 chicken · 2 wildcards across Mon–Thu, skipping days with specials
            </Text>
            {buildPicks.length === 0 ? (
              <Text style={styles.emptyText}>All Mon–Thu days have specials — nothing to fill.</Text>
            ) : (
              buildPicks.map(({ date, recipe }, i) => {
                const dayIndex = weekDates.findIndex((d) => toDateStr(d) === toDateStr(date));
                return (
                  <View key={i} style={styles.buildRow}>
                    <Text style={styles.buildDay}>{DAY_NAMES[dayIndex]}</Text>
                    <View style={styles.buildRecipeCard}>
                      <Text style={styles.buildRecipeTitle}>{recipe.title}</Text>
                      {recipe.protein && <Text style={styles.buildRecipeProtein}>{PROTEIN_LABEL[recipe.protein]}</Text>}
                    </View>
                  </View>
                );
              })
            )}
            <TouchableOpacity style={styles.regenerateBtn} onPress={regenerate}>
              <Ionicons name="refresh-outline" size={18} color={C.red} />
              <Text style={styles.regenerateText}>Shuffle again</Text>
            </TouchableOpacity>
          </ScrollView>
          <View style={styles.buildFooter}>
            <TouchableOpacity style={styles.clearBtn} onPress={() => setBuildOpen(false)}>
              <Text style={styles.clearBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyBtn, buildPicks.length === 0 && { opacity: 0.4 }]}
              onPress={applyBuildWeek}
              disabled={buildPicks.length === 0}
            >
              <Text style={styles.applyBtnText}>Apply Week</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    weekNav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    navBtn: { padding: 8 },
    weekLabel: { fontSize: 16, fontWeight: '700', color: C.text, flex: 1, textAlign: 'center' },
    buildBtn: { padding: 8 },
    varietyRow: { borderBottomWidth: 1, borderBottomColor: C.borderLight, maxHeight: 44 },
    varietyContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 6, flexDirection: 'row' },
    varietyChip: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.varietyChip, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    },
    varietyChipWarn: { backgroundColor: C.warnChip, borderWidth: 1, borderColor: C.warnBorder },
    varietyText: { fontSize: 12, color: C.textMuted, fontWeight: '600' },
    varietyTextWarn: { color: C.red },
    grid: { padding: 16, gap: 12 },
    dayCard: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
    dayCardToday: { borderColor: C.red, borderWidth: 2 },
    dayHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: C.borderLight,
    },
    dayName: { fontSize: 15, fontWeight: '800', color: C.text, width: 36 },
    dayNameToday: { color: C.red },
    dayDate: { fontSize: 14, color: C.textMuted },
    dayDateToday: { color: C.red },
    specialEditBtn: { marginLeft: 'auto' },
    specialBadge: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.warnChip, borderRadius: 12,
      paddingHorizontal: 10, paddingVertical: 4,
      borderWidth: 1, borderColor: C.warnBorder,
    },
    specialBadgeText: { fontSize: 12, color: C.red, fontWeight: '700' },
    dayBody: { paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
    assignedRecipe: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.inputBg, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10,
      borderWidth: 1, borderColor: C.borderLight,
    },
    assignedTitle: { fontSize: 15, fontWeight: '600', color: C.text },
    assignedLink: { fontSize: 11, color: C.red, marginTop: 2 },
    recipeActionBtn: { padding: 2, marginLeft: 6 },
    addSlot: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
    addSlotText: { fontSize: 14, color: C.textMuted },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyText: { fontSize: 16, color: C.textMuted, textAlign: 'center' },
    modal: { flex: 1, backgroundColor: C.bg },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    modalTitle: { fontSize: 22, fontWeight: '800', color: C.text },
    specialOverlay: {
      flex: 1, backgroundColor: C.overlay,
      justifyContent: 'center', alignItems: 'center', padding: 32,
    },
    specialSheet: {
      backgroundColor: C.card, borderRadius: 16, padding: 24,
      width: '100%', borderWidth: 1, borderColor: C.border,
    },
    specialSheetTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 4 },
    specialSheetSub: { fontSize: 13, color: C.textMuted, marginBottom: 16 },
    specialSheetInput: {
      backgroundColor: C.inputBg, borderRadius: 10, paddingHorizontal: 14,
      paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: C.border,
      color: C.text, marginBottom: 16,
    },
    specialSheetBtns: { flexDirection: 'row', gap: 12 },
    specialCancelBtn: {
      flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
      borderWidth: 1, borderColor: C.border,
    },
    specialCancelText: { fontSize: 15, color: C.textMuted, fontWeight: '600' },
    specialSaveBtn: { flex: 1, backgroundColor: C.red, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    specialSaveText: { fontSize: 15, color: '#fff', fontWeight: '700' },
    pickerFooter: {
      borderTopWidth: 1, borderTopColor: C.border, padding: 16,
    },
    addNewRecipeBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, paddingVertical: 12, borderRadius: 12,
      borderWidth: 1, borderColor: C.red,
    },
    addNewRecipeText: { fontSize: 15, color: C.red, fontWeight: '700' },
    pickerSearchWrap: {
      flexDirection: 'row', alignItems: 'center',
      margin: 16, marginBottom: 0,
      backgroundColor: C.inputBg, borderRadius: 10,
      borderWidth: 1, borderColor: C.border, paddingHorizontal: 10,
    },
    pickerSearchIcon: { marginRight: 6 },
    pickerSearchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: C.text },
    recipeOption: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
      marginBottom: 10, borderWidth: 1, borderColor: C.border,
    },
    recipeOptionText: { fontSize: 16, fontWeight: '600', color: C.text },
    recipeOptionSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
    buildContent: { padding: 20, paddingBottom: 40 },
    buildSubtitle: { fontSize: 13, color: C.textMuted, marginBottom: 20 },
    buildRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
    buildDay: { fontSize: 14, fontWeight: '800', color: C.textMuted, width: 36 },
    buildRecipeCard: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
    buildRecipeTitle: { fontSize: 15, fontWeight: '700', color: C.text },
    buildRecipeProtein: { fontSize: 12, color: C.red, fontWeight: '600', marginTop: 3 },
    regenerateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20, paddingVertical: 12 },
    regenerateText: { fontSize: 15, color: C.red, fontWeight: '600' },
    buildFooter: { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: C.border },
    clearBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
    clearBtnText: { fontSize: 16, color: C.textMuted, fontWeight: '600' },
    applyBtn: { flex: 2, backgroundColor: C.red, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    applyBtnText: { fontSize: 16, color: '#fff', fontWeight: '700' },
  });
}
