import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, ScrollView, TextInput,
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
  notMadeRecently: boolean;
};

function filterCount(f: Filters) {
  return f.sources.length + f.proteins.length + f.timings.length + (f.notMadeRecently ? 1 : 0);
}

function applyFilters(recipes: Recipe[], filters: Filters, search: string, recentIds: Set<string>): Recipe[] {
  const q = search.toLowerCase().trim();
  return recipes.filter((r) => {
    if (q && !r.title.toLowerCase().includes(q)) return false;
    if (filters.sources.length && !filters.sources.includes(getSource(r.url))) return false;
    if (filters.proteins.length && !filters.proteins.includes(r.protein as Protein)) return false;
    if (filters.timings.length && !filters.timings.includes(r.timing as Timing)) return false;
    if (filters.notMadeRecently && recentIds.has(r.id)) return false;
    return true;
  });
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function RecipesScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [filters, setFilters] = useState<Filters>({ sources: [], proteins: [], timings: [], notMadeRecently: false });
  const router = useRouter();

  const fetchData = useCallback(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ago = thirtyDaysAgo.toISOString().split('T')[0];

    const [recipesRes, plansRes, userRes] = await Promise.all([
      supabase.from('recipes').select('*').order('title'),
      supabase.from('meal_plans').select('recipe_id').gte('date', ago),
      supabase.auth.getUser(),
    ]);

    setRecipes(recipesRes.data ?? []);
    setRecentIds(new Set((plansRes.data ?? []).map((p: any) => p.recipe_id).filter(Boolean)));
    setUserEmail(userRes.data.user?.email ?? '');
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]));

  async function signOut() { await supabase.auth.signOut(); }

  const allSources = [...new Set(recipes.map((r) => getSource(r.url)))].sort();
  const filtered = applyFilters(recipes, filters, search, recentIds);
  const activeFilters = filterCount(filters);

  // "Try something new" = recipes not used in 30 days, shuffled, max 8
  const tryNew = shuffle(recipes.filter((r) => !recentIds.has(r.id))).slice(0, 8);
  const showTryNew = !search && !activeFilters && tryNew.length > 0;

  function doShuffle() {
    if (filtered.length === 0) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    router.push(`/(tabs)/recipes/${pick.id}`);
  }

  function toggleSource(s: string) {
    setFilters((f) => ({ ...f, sources: f.sources.includes(s) ? f.sources.filter((x) => x !== s) : [...f.sources, s] }));
  }
  function toggleProtein(p: Protein) {
    setFilters((f) => ({ ...f, proteins: f.proteins.includes(p) ? f.proteins.filter((x) => x !== p) : [...f.proteins, p] }));
  }
  function toggleTiming(t: Timing) {
    setFilters((f) => ({ ...f, timings: f.timings.includes(t) ? f.timings.filter((x) => x !== t) : [...f.timings, t] }));
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#CC0000" /></View>;
  }

  const ListHeader = showTryNew ? (
    <View style={styles.tryNewSection}>
      <Text style={styles.tryNewTitle}>Try something new</Text>
      <Text style={styles.tryNewSub}>Not planned in the last 30 days</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tryNewScroll}>
        {tryNew.map((r) => (
          <TouchableOpacity key={r.id} style={styles.tryNewCard} onPress={() => router.push(`/(tabs)/recipes/${r.id}`)}>
            <Text style={styles.tryNewCardTitle} numberOfLines={2}>{r.title}</Text>
            {r.protein && <Text style={styles.tryNewCardTag}>{PROTEIN_LABEL[r.protein as Protein]}</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  ) : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recipes</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setAccountOpen(true)}>
            <Ionicons name="person-circle-outline" size={28} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setFiltersOpen(true)}>
            <Ionicons name="options-outline" size={22} color={activeFilters ? '#CC0000' : '#888'} />
            {activeFilters > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{activeFilters}</Text></View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(tabs)/recipes/new')}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="#bbb" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search recipes..."
          placeholderTextColor="#bbb"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
        <TouchableOpacity
          style={[styles.shuffleBtn, filtered.length === 0 && styles.shuffleBtnDisabled]}
          onPress={doShuffle}
          disabled={filtered.length === 0}
        >
          <Ionicons name="shuffle-outline" size={20} color={filtered.length > 0 ? '#CC0000' : '#ddd'} />
        </TouchableOpacity>
      </View>

      {(activeFilters > 0 || search) && (
        <View style={styles.activeFilterRow}>
          <Text style={styles.activeFilterText}>{filtered.length} of {recipes.length} recipes</Text>
          <TouchableOpacity onPress={() => { setFilters({ sources: [], proteins: [], timings: [], notMadeRecently: false }); setSearch(''); }}>
            <Text style={styles.clearFilters}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      {filtered.length === 0 && (search || activeFilters) ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={64} color="#E8E0D8" />
          <Text style={styles.emptyText}>No recipes match</Text>
          <TouchableOpacity onPress={() => { setFilters({ sources: [], proteins: [], timings: [], notMadeRecently: false }); setSearch(''); }}>
            <Text style={styles.clearFilters}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={ListHeader}
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
                    <View style={styles.tag}><Text style={styles.tagText}>{PROTEIN_LABEL[item.protein as Protein]}</Text></View>
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

      {/* Account Modal */}
      <Modal visible={accountOpen} animationType="fade" transparent>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setAccountOpen(false)}>
          <View style={styles.accountSheet}>
            <Text style={styles.accountEmail}>{userEmail}</Text>
            <TouchableOpacity style={styles.signOutBtn} onPress={() => { setAccountOpen(false); signOut(); }}>
              <Ionicons name="log-out-outline" size={18} color="#CC0000" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
            <Text style={styles.filterSectionLabel}>Quick</Text>
            <View style={styles.chipWrap}>
              <TouchableOpacity
                style={[styles.chip, filters.notMadeRecently && styles.chipActive]}
                onPress={() => setFilters((f) => ({ ...f, notMadeRecently: !f.notMadeRecently }))}
              >
                <Text style={[styles.chipText, filters.notMadeRecently && styles.chipTextActive]}>
                  Not made in 30 days
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.filterSectionLabel}>Protein</Text>
            <View style={styles.chipWrap}>
              {PROTEINS.map((p) => (
                <TouchableOpacity key={p} style={[styles.chip, filters.proteins.includes(p) && styles.chipActive]} onPress={() => toggleProtein(p)}>
                  <Text style={[styles.chipText, filters.proteins.includes(p) && styles.chipTextActive]}>{PROTEIN_LABEL[p]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.filterSectionLabel}>Timing</Text>
            <View style={styles.chipWrap}>
              {TIMINGS.map(({ value, label }) => (
                <TouchableOpacity key={value} style={[styles.chip, filters.timings.includes(value) && styles.chipActive]} onPress={() => toggleTiming(value)}>
                  <Text style={[styles.chipText, filters.timings.includes(value) && styles.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.filterSectionLabel}>Source</Text>
            <View style={styles.chipWrap}>
              {allSources.map((s) => (
                <TouchableOpacity key={s} style={[styles.chip, filters.sources.includes(s) && styles.chipActive]} onPress={() => toggleSource(s)}>
                  <Text style={[styles.chipText, filters.sources.includes(s) && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.clearBtn} onPress={() => setFilters({ sources: [], proteins: [], timings: [], notMadeRecently: false })}>
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={() => setFiltersOpen(false)}>
              <Text style={styles.applyBtnText}>
                Show {applyFilters(recipes, filters, search, recentIds).length} Recipes
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12,
  },
  title: { fontSize: 32, fontWeight: '800', color: '#1A1A2E' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { padding: 6, position: 'relative' },
  badge: {
    position: 'absolute', top: 2, right: 2, backgroundColor: '#CC0000',
    borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  addButton: {
    backgroundColor: '#CC0000', width: 44, height: 44,
    borderRadius: 22, alignItems: 'center', justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 10,
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#E8E0D8', paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: '#1A1A2E' },
  shuffleBtn: { padding: 6 },
  shuffleBtnDisabled: { opacity: 0.4 },
  activeFilterRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 8,
  },
  activeFilterText: { fontSize: 13, color: '#888' },
  clearFilters: { fontSize: 13, color: '#CC0000', fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  // Try something new
  tryNewSection: { marginBottom: 20 },
  tryNewTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginBottom: 2 },
  tryNewSub: { fontSize: 12, color: '#aaa', marginBottom: 12 },
  tryNewScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  tryNewCard: {
    width: 140, backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginRight: 10, borderWidth: 1, borderColor: '#E8E0D8',
    justifyContent: 'space-between', minHeight: 90,
  },
  tryNewCardTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  tryNewCardTag: { fontSize: 11, color: '#CC0000', fontWeight: '600' },
  // Recipe cards
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#E8E0D8', flexDirection: 'row', alignItems: 'center',
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
  // Account
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  accountSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40, gap: 16,
  },
  accountEmail: { fontSize: 15, color: '#888', textAlign: 'center' },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#FFD0D0',
    backgroundColor: '#FFF5F5',
  },
  signOutText: { fontSize: 16, fontWeight: '700', color: '#CC0000' },
  // Filter modal
  modal: { flex: 1, backgroundColor: '#FFF8F3' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: '#E8E0D8',
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  modalContent: { padding: 20, paddingBottom: 40 },
  filterSectionLabel: {
    fontSize: 13, fontWeight: '700', color: '#CC0000',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 20,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#E8E0D8', backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#CC0000', borderColor: '#CC0000' },
  chipText: { fontSize: 14, color: '#555', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  modalFooter: {
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
