import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import type { MealPlan } from '../../lib/types';

function getWeekDates(): { start: string; end: string; label: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const label = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  return { start: fmt(monday), end: fmt(sunday), label };
}

type ShoppingItem = {
  key: string;
  ingredient: string;
  recipes: string[];
  checked: boolean;
};

function buildShoppingList(plans: MealPlan[]): ShoppingItem[] {
  const map = new Map<string, { ingredient: string; recipes: Set<string> }>();

  for (const plan of plans) {
    if (!plan.recipe) continue;
    for (const ing of plan.recipe.ingredients) {
      const ingredient = [ing.amount, ing.unit, ing.name].filter(Boolean).join(' ').trim();
      const key = ing.name.toLowerCase().trim();
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, { ingredient, recipes: new Set() });
      }
      map.get(key)!.recipes.add(plan.recipe.title);
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { ingredient, recipes }]) => ({
      key,
      ingredient,
      recipes: Array.from(recipes),
      checked: false,
    }));
}

export default function ShoppingScreen() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const week = getWeekDates();

  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .from('meal_plans')
      .select('*, recipe:recipes(*)')
      .gte('date', week.start)
      .lte('date', week.end);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setItems(buildShoppingList(data as MealPlan[]));
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData])
  );

  function toggleItem(key: string) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, checked: !item.checked } : item))
    );
  }

  function uncheckAll() {
    setItems((prev) => prev.map((item) => ({ ...item, checked: false })));
  }

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.weekBadge}>
        <Ionicons name="calendar-outline" size={14} color="#FF6B35" />
        <Text style={styles.weekText}>{week.label}</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cart-outline" size={64} color="#E8E0D8" />
          <Text style={styles.emptyText}>Nothing planned yet</Text>
          <Text style={styles.emptySubtext}>Add meals in the Planner tab to generate your list</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {unchecked.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.itemRow}
              onPress={() => toggleItem(item.key)}
              activeOpacity={0.7}
            >
              <View style={styles.checkbox} />
              <View style={styles.itemText}>
                <Text style={styles.itemName}>{item.ingredient}</Text>
                <Text style={styles.itemSource}>{item.recipes.join(', ')}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {checked.length > 0 && (
            <>
              <View style={styles.divider}>
                <Text style={styles.dividerText}>In cart ({checked.length})</Text>
                <TouchableOpacity onPress={uncheckAll}>
                  <Text style={styles.uncheckAll}>Uncheck all</Text>
                </TouchableOpacity>
              </View>
              {checked.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.itemRow, styles.itemRowChecked]}
                  onPress={() => toggleItem(item.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, styles.checkboxChecked]}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                  <View style={styles.itemText}>
                    <Text style={[styles.itemName, styles.itemNameChecked]}>{item.ingredient}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F3' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  weekBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E0D8',
  },
  weekText: { fontSize: 13, color: '#FF6B35', fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8E0',
    gap: 14,
  },
  itemRowChecked: { opacity: 0.5 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8E0D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  itemText: { flex: 1 },
  itemName: { fontSize: 16, color: '#1A1A2E', fontWeight: '500' },
  itemNameChecked: { textDecorationLine: 'line-through' },
  itemSource: { fontSize: 12, color: '#bbb', marginTop: 2 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 4,
  },
  dividerText: { fontSize: 12, color: '#aaa', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  uncheckAll: { fontSize: 12, color: '#FF6B35', fontWeight: '600' },
  emptyText: { fontSize: 20, fontWeight: '600', color: '#888', marginTop: 16, textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: '#bbb', marginTop: 8, textAlign: 'center' },
});
