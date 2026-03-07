import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { getSource, type Recipe, type Protein, type Timing } from '../../../lib/types';

const PROTEINS: Protein[] = ['chicken', 'salmon', 'shrimp', 'beef', 'pork', 'lamb', 'tofu', 'veggie'];
const PROTEIN_LABEL: Record<Protein, string> = {
  chicken: 'Chicken', salmon: 'Salmon', shrimp: 'Shrimp', beef: 'Beef',
  pork: 'Pork', lamb: 'Lamb', tofu: 'Tofu', veggie: 'Veggie',
};
const TIMINGS: { value: Timing; label: string }[] = [
  { value: 'weekday', label: 'Weekday' },
  { value: 'weekend', label: 'Weekend' },
];

type Filters = {
  sources: string[];
  proteins: Protein[];
  timings: Timing[];
};

function applyFilters(recipes: Recipe[], filters: Filters): Recipe[] {
  return recipes.filter((r) => {
    if (filters.sources.length && !filters.sources.includes(getSource(r.url))) return false;
    if (filters.proteins.length && !filters.proteins.includes(r.protein as Protein)) return false;
    if (filters.timings.length && !filters.timings.includes(r.timing as Timing)) return false;
    return true;
  });
}

function filterCount(filters: Filters): number {
  return filters.sources.length + filters.proteins.length + filters.timings.length;
}

export default function RecipesScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({ sources: [], proteins: [], timings: [] });
  const router = useRouter();

  const fetchRecipes = useCallback(async () => {
    const { data, error } = await supabase.from('recipes').select('*').order('title');
    if (error) Alert.alert('Error', error.message);
    else setRecipes(data ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchRecipes();
    }, [fetchRecipes])
  );

  const allSources = [...new Set(recipes.map((r) => getSource(r.url)))].sort();
  const filtered = applyFilters(recipes, filters);
  const activeFilters = filterCount(filters);

  function toggleSource(s: string) {
    setFilters((f) => ({
      ...f,
      sources: f.sources.includes(s) ? f.sources.filter((x) => x !== s) : [...f.sources, s],
    }));
  }
  function toggleProtein(p: Protein) {
    setFilters((f) => ({
      ...f,
      proteins: f.proteins.includes(p) ? f.proteins.filter((x) => x !== p) : [...f.proteins, p],
    }));
  }
  function toggleTiming(t: Timing) {
    setFilters((f) => ({
      ...f,
      timings: f.timings.includes(t) ? f.timings.filter((x) => x !== t) : [...f.timings, t],
    }));
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#CC0000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recipes</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.filterBtn} onPress={() => setFiltersOpen(true)}>
            <Ionicons name="options-outline" size={20} color={activeFilters ? '#CC0000' : '#888'} />
            {activeFilters > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeFilters}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(tabs)/recipes/new')}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {activeFilters > 0 && (
        <View style={styles.activeFilterRow}>
          <Text style={styles.activeFilterText}>
            {filtered.length} of {recipes.length} recipes
          </Text>
          <TouchableOpacity onPress={() => setFilters({ sources: [], proteins: [], timings: [] })}>
            <Text style={styles.clearFilters}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      )}

      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={64} color="#E8E0D8" />
          <Text style={styles.emptyText}>No recipes match</Text>
          <TouchableOpacity onPress={() => setFilters({ sources: [], proteins: [], timings: [] })}>
            <Text style={styles.clearFilters}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(tabs)/recipes/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardLeft}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.cardTags}>
                  {item.protein && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{PROTEIN_LABEL[item.protein as Protein]}</Text>
                    </View>
                  )}
                  {item.timing && (
                    <View style={[styles.tag, styles.tagTiming]}>
                      <Text style={styles.tagText}>{item.timing === 'weekday' ? 'Weekday' : 'Weekend'}</Text>
                    </View>
                  )}
                  {item.url && (
                    <View style={[styles.tag, styles.tagSource]}>
                      <Text style={styles.tagText}>{getSource(item.url)}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#ddd" />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Filter Modal */}
      <Modal visible={filtersOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Recipes</Text>
            <TouchableOpacity onPress={() => setFiltersOpen(false)}>
              <Ionicons name="close" size={26} color="#1A1A2E" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.filterSectionLabel}>Protein</Text>
            <View style={styles.chipWrap}>
              {PROTEINS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, filters.proteins.includes(p) && styles.chipActive]}
                  onPress={() => toggleProtein(p)}
                >
                  <Text style={[styles.chipText, filters.proteins.includes(p) && styles.chipTextActive]}>
                    {PROTEIN_LABEL[p]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionLabel}>Timing</Text>
            <View style={styles.chipWrap}>
              {TIMINGS.map(({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, filters.timings.includes(value) && styles.chipActive]}
                  onPress={() => toggleTiming(value)}
                >
                  <Text style={[styles.chipText, filters.timings.includes(value) && styles.chipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionLabel}>Source</Text>
            <View style={styles.chipWrap}>
              {allSources.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, filters.sources.includes(s) && styles.chipActive]}
                  onPress={() => toggleSource(s)}
                >
                  <Text style={[styles.chipText, filters.sources.includes(s) && styles.chipTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => setFilters({ sources: [], proteins: [], timings: [] })}
            >
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={() => setFiltersOpen(false)}>
              <Text style={styles.applyBtnText}>
                Show {applyFilters(recipes, filters).length} Recipes
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F3' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: { fontSize: 32, fontWeight: '800', color: '#1A1A2E' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filterBtn: { padding: 8, position: 'relative' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#CC0000',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  addButton: {
    backgroundColor: '#CC0000',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFilterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  activeFilterText: { fontSize: 13, color: '#888' },
  clearFilters: { fontSize: 13, color: '#CC0000', fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E0D8',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  cardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { backgroundColor: '#F0E8E0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  tagTiming: { backgroundColor: '#E8F0FF' },
  tagSource: { backgroundColor: '#F0F0F0' },
  tagText: { fontSize: 11, color: '#666', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#888' },
  // Modal
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
  modalContent: { padding: 20, paddingBottom: 40 },
  filterSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CC0000',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 20,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E0D8',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#CC0000', borderColor: '#CC0000' },
  chipText: { fontSize: 14, color: '#555', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E8E0D8',
  },
  clearBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E0D8',
  },
  clearBtnText: { fontSize: 16, color: '#888', fontWeight: '600' },
  applyBtn: {
    flex: 2,
    backgroundColor: '#CC0000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyBtnText: { fontSize: 16, color: '#fff', fontWeight: '700' },
});
