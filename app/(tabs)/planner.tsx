import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import type { Recipe, MealPlan, MealSlot } from '../../lib/types';

const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

function getWeekDates(offset = 0): Date[] {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
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

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PlannerScreen() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekDates, setWeekDates] = useState<Date[]>(getWeekDates(0));
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<{ date: string; slot: MealSlot } | null>(null);

  useEffect(() => {
    setWeekDates(getWeekDates(weekOffset));
  }, [weekOffset]);

  const fetchData = useCallback(async () => {
    const dates = getWeekDates(weekOffset);
    const start = toDateStr(dates[0]);
    const end = toDateStr(dates[6]);

    const [plansRes, recipesRes] = await Promise.all([
      supabase
        .from('meal_plans')
        .select('*, recipe:recipes(*)')
        .gte('date', start)
        .lte('date', end),
      supabase.from('recipes').select('*').order('title'),
    ]);

    if (plansRes.error) Alert.alert('Error', plansRes.error.message);
    else setMealPlans(plansRes.data ?? []);

    if (recipesRes.error) Alert.alert('Error', recipesRes.error.message);
    else setRecipes(recipesRes.data ?? []);

    setLoading(false);
  }, [weekOffset]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData])
  );

  function getMealPlan(date: string, slot: MealSlot): MealPlan | undefined {
    return mealPlans.find((m) => m.date === date && m.meal_slot === slot);
  }

  async function assignRecipe(recipe: Recipe) {
    if (!picking) return;
    const existing = getMealPlan(picking.date, picking.slot);

    if (existing) {
      const { error } = await supabase
        .from('meal_plans')
        .update({ recipe_id: recipe.id })
        .eq('id', existing.id);
      if (error) Alert.alert('Error', error.message);
    } else {
      const { error } = await supabase
        .from('meal_plans')
        .insert({ date: picking.date, meal_slot: picking.slot, recipe_id: recipe.id });
      if (error) Alert.alert('Error', error.message);
    }

    setPicking(null);
    fetchData();
  }

  async function clearSlot(date: string, slot: MealSlot) {
    const existing = getMealPlan(date, slot);
    if (!existing) return;
    const { error } = await supabase.from('meal_plans').delete().eq('id', existing.id);
    if (error) Alert.alert('Error', error.message);
    else fetchData();
  }

  const weekLabel = (() => {
    if (weekDates.length === 0) return '';
    const start = weekDates[0];
    const end = weekDates[6];
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  })();

  return (
    <View style={styles.container}>
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => setWeekOffset((o) => o - 1)} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color="#FF6B35" />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
        <TouchableOpacity onPress={() => setWeekOffset((o) => o + 1)} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color="#FF6B35" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {weekDates.map((date, di) => {
            const dateStr = toDateStr(date);
            const isToday = toDateStr(new Date()) === dateStr;
            return (
              <View key={dateStr} style={styles.dayBlock}>
                <View style={[styles.dayHeader, isToday && styles.dayHeaderToday]}>
                  <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                    {DAY_NAMES[di]}
                  </Text>
                  <Text style={[styles.dayDate, isToday && styles.dayDateToday]}>
                    {date.getDate()}
                  </Text>
                </View>
                {MEAL_SLOTS.map((slot) => {
                  const plan = getMealPlan(dateStr, slot);
                  return (
                    <View key={slot} style={styles.slotRow}>
                      <Text style={styles.slotLabel}>{SLOT_LABEL[slot]}</Text>
                      {plan?.recipe ? (
                        <TouchableOpacity
                          style={styles.recipePill}
                          onLongPress={() => clearSlot(dateStr, slot)}
                          onPress={() => setPicking({ date: dateStr, slot })}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.recipePillText} numberOfLines={1}>
                            {plan.recipe.title}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.emptySlot}
                          onPress={() => setPicking({ date: dateStr, slot })}
                        >
                          <Ionicons name="add" size={16} color="#ccc" />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}

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
              <Text style={styles.emptyText}>No recipes yet. Add some first!</Text>
            </View>
          ) : (
            <FlatList
              data={recipes}
              keyExtractor={(r) => r.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.recipeOption} onPress={() => assignRecipe(item)}>
                  <Text style={styles.recipeOptionText}>{item.title}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#ccc" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F3' },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E0D8',
  },
  navBtn: { padding: 8 },
  weekLabel: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  grid: { padding: 16, gap: 16 },
  dayBlock: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E0D8',
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAF0E8',
  },
  dayHeaderToday: { backgroundColor: '#FF6B35' },
  dayName: { fontSize: 14, fontWeight: '700', color: '#888' },
  dayNameToday: { color: '#fff' },
  dayDate: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  dayDateToday: { color: '#fff' },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0E8E0',
  },
  slotLabel: { fontSize: 12, color: '#aaa', width: 72, fontWeight: '600' },
  recipePill: {
    flex: 1,
    backgroundColor: '#FFF0E8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FFD4BC',
  },
  recipePillText: { fontSize: 13, color: '#FF6B35', fontWeight: '600' },
  emptySlot: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E0D8',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1, backgroundColor: '#FFF8F3' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E0D8',
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  recipeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E0D8',
  },
  recipeOptionText: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  emptyText: { fontSize: 16, color: '#888' },
});
