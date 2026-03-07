import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Linking,
  Modal,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { getSource, type Recipe, type Protein } from '../../../lib/types';

const PROTEIN_LABEL: Record<Protein, string> = {
  chicken: 'Chicken', salmon: 'Salmon', shrimp: 'Shrimp', beef: 'Beef',
  pork: 'Pork', lamb: 'Lamb', tofu: 'Tofu', veggie: 'Veggie',
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekDates(): { date: Date; dateStr: string; label: string }[] {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    return { date: d, dateStr, label: `${DAY_NAMES[i]}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` };
  });
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [existingPlans, setExistingPlans] = useState<Record<string, string>>({}); // dateStr -> planId
  const router = useRouter();
  const weekDates = getWeekDates();

  useEffect(() => {
    supabase.from('recipes').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) Alert.alert('Error', error.message);
      else setRecipe(data);
      setLoading(false);
    });
  }, [id]);

  async function openPlanner() {
    const dates = weekDates.map((d) => d.dateStr);
    const { data } = await supabase
      .from('meal_plans')
      .select('id, date')
      .in('date', dates)
      .eq('meal_slot', 'dinner');
    const map: Record<string, string> = {};
    for (const p of data ?? []) map[p.date] = p.id;
    setExistingPlans(map);
    setPlannerOpen(true);
  }

  async function assignToDay(dateStr: string) {
    const existing = existingPlans[dateStr];
    if (existing) {
      await supabase.from('meal_plans').update({ recipe_id: id }).eq('id', existing);
    } else {
      await supabase.from('meal_plans').insert({ date: dateStr, meal_slot: 'dinner', recipe_id: id });
    }
    setPlannerOpen(false);
    Alert.alert('Added!', `${recipe?.title} added to ${weekDates.find((d) => d.dateStr === dateStr)?.label}`);
  }

  async function deleteRecipe() {
    Alert.alert('Delete Recipe', `Delete "${recipe?.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('recipes').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else router.back();
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#CC0000" /></View>;
  }
  if (!recipe) return null;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{recipe.title}</Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/recipes/new', params: { id } })} style={styles.actionBtn}>
              <Ionicons name="pencil-outline" size={20} color="#CC0000" />
            </TouchableOpacity>
            <TouchableOpacity onPress={deleteRecipe} style={styles.actionBtn}>
              <Ionicons name="trash-outline" size={20} color="#E53935" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tags */}
        <View style={styles.tagRow}>
          {recipe.protein && (
            <View style={styles.tag}><Text style={styles.tagText}>{PROTEIN_LABEL[recipe.protein as Protein]}</Text></View>
          )}
          {recipe.timing && (
            <View style={[styles.tag, styles.tagTiming]}>
              <Text style={styles.tagText}>{recipe.timing === 'weekday' ? 'Weekday' : 'Weekend'}</Text>
            </View>
          )}
          {recipe.url && (
            <View style={[styles.tag, styles.tagSource]}>
              <Text style={styles.tagText}>{getSource(recipe.url)}</Text>
            </View>
          )}
        </View>

        {recipe.url && (
          <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL(recipe.url!)}>
            <Ionicons name="open-outline" size={18} color="#CC0000" />
            <Text style={styles.linkText}>Open Recipe</Text>
          </TouchableOpacity>
        )}

        {recipe.notes && (
          <>
            <Text style={styles.sectionLabel}>Notes</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{recipe.notes}</Text>
            </View>
          </>
        )}

        {!recipe.url && !recipe.notes && (
          <Text style={styles.emptyState}>No link or notes added.</Text>
        )}

        <TouchableOpacity style={styles.addToPlannerBtn} onPress={openPlanner}>
          <Ionicons name="calendar-outline" size={18} color="#fff" />
          <Text style={styles.addToPlannerText}>Add to This Week</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={plannerOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pick a Day</Text>
            <TouchableOpacity onPress={() => setPlannerOpen(false)}>
              <Ionicons name="close" size={26} color="#1A1A2E" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={weekDates}
            keyExtractor={(d) => d.dateStr}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => {
              const hasRecipe = !!existingPlans[item.dateStr];
              const isToday = item.dateStr === new Date().toISOString().split('T')[0];
              return (
                <TouchableOpacity style={styles.dayOption} onPress={() => assignToDay(item.dateStr)}>
                  <View>
                    <Text style={[styles.dayOptionLabel, isToday && styles.dayOptionToday]}>{item.label}</Text>
                    {hasRecipe && <Text style={styles.dayOptionSub}>Already has a meal — will replace</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#ccc" />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F3' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8F3' },
  titleRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 12,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#1A1A2E', flex: 1, marginRight: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
  tag: { backgroundColor: '#F0E8E0', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  tagTiming: { backgroundColor: '#E8F0FF' },
  tagSource: { backgroundColor: '#F0F0F0' },
  tagText: { fontSize: 12, color: '#666', fontWeight: '600' },
  linkButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F0', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#FFCCCC', marginBottom: 24,
  },
  linkText: { fontSize: 16, fontWeight: '600', color: '#CC0000' },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: '#CC0000',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
  },
  notesBox: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#E8E0D8',
  },
  notesText: { fontSize: 15, color: '#555', lineHeight: 22 },
  emptyState: { fontSize: 15, color: '#bbb', textAlign: 'center', marginTop: 40 },
  addToPlannerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#CC0000', borderRadius: 14, paddingVertical: 16, marginTop: 32,
  },
  addToPlannerText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modal: { flex: 1, backgroundColor: '#FFF8F3' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: '#E8E0D8',
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  dayOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#E8E0D8',
  },
  dayOptionLabel: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  dayOptionToday: { color: '#CC0000' },
  dayOptionSub: { fontSize: 12, color: '#aaa', marginTop: 2 },
});
