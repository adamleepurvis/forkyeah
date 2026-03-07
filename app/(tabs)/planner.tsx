import { useCallback, useState } from 'react';
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

export default function PlannerScreen() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekDates, setWeekDates] = useState<Date[]>(getWeekDates(0));
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null); // date string

  const fetchData = useCallback(async () => {
    const dates = getWeekDates(weekOffset);
    setWeekDates(dates);
    const start = toDateStr(dates[0]);
    const end = toDateStr(dates[6]);

    const [plansRes, recipesRes] = await Promise.all([
      supabase
        .from('meal_plans')
        .select('*, recipe:recipes(*)')
        .gte('date', start)
        .lte('date', end)
        .eq('meal_slot', 'dinner'),
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

  function getMealPlan(date: string): MealPlan | undefined {
    return mealPlans.find((m) => m.date === date);
  }

  async function assignRecipe(recipe: Recipe) {
    if (!picking) return;
    const existing = getMealPlan(picking);

    if (existing) {
      await supabase.from('meal_plans').update({ recipe_id: recipe.id }).eq('id', existing.id);
    } else {
      await supabase
        .from('meal_plans')
        .insert({ date: picking, meal_slot: 'dinner', recipe_id: recipe.id });
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

  const weekLabel = weekDates.length
    ? `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : '';

  return (
    <View style={styles.container}>
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => setWeekOffset((o) => o - 1)} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color="#CC0000" />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
        <TouchableOpacity onPress={() => setWeekOffset((o) => o + 1)} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color="#CC0000" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#CC0000" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {weekDates.map((date, i) => {
            const dateStr = toDateStr(date);
            const isToday = toDateStr(new Date()) === dateStr;
            const plan = getMealPlan(dateStr);

            return (
              <View key={dateStr} style={[styles.dayCard, isToday && styles.dayCardToday]}>
                <View style={styles.dayHeader}>
                  <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                    {DAY_NAMES[i]}
                  </Text>
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
                  <TouchableOpacity
                    style={styles.emptySlot}
                    onPress={() => setPicking(dateStr)}
                  >
                    <Ionicons name="add-circle-outline" size={22} color="#E8E0D8" />
                    <Text style={styles.emptySlotText}>Add dinner</Text>
                  </TouchableOpacity>
                )}
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
              <Text style={styles.emptyText}>No recipes yet. Add some in the Recipes tab!</Text>
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
  grid: { padding: 16, gap: 12 },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E0D8',
    overflow: 'hidden',
  },
  dayCardToday: { borderColor: '#CC0000', borderWidth: 2 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8E0',
  },
  dayName: { fontSize: 15, fontWeight: '800', color: '#1A1A2E', width: 36 },
  dayNameToday: { color: '#CC0000' },
  dayDate: { fontSize: 14, color: '#999' },
  dayDateToday: { color: '#CC0000' },
  assignedRecipe: {
    padding: 16,
  },
  assignedTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  assignedHint: { fontSize: 11, color: '#ccc', marginTop: 4 },
  emptySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },
  emptySlotText: { fontSize: 15, color: '#ccc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
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
  emptyText: { fontSize: 16, color: '#888', textAlign: 'center' },
});
