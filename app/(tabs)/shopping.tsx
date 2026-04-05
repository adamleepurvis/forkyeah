import { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import type { ShoppingItem } from '../../lib/types';
import { useColors, type Colors } from '../../lib/colors';

export default function ShoppingScreen() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');
  const [adding, setAdding] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const C = useColors();
  const styles = makeStyles(C);

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('shopping_items')
      .select('*')
      .order('position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
    if (error) Alert.alert('Error', error.message);
    else setItems(data ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchItems();
  }, [fetchItems]));

  async function addItem() {
    const name = newItem.trim();
    if (!name) return;
    setAdding(true);
    const { error } = await supabase.from('shopping_items').insert({ name });
    if (error) Alert.alert('Error', error.message);
    else { setNewItem(''); fetchItems(); }
    setAdding(false);
  }

  async function toggleItem(item: ShoppingItem) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await supabase.from('shopping_items').update({ checked: !item.checked }).eq('id', item.id);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)));
  }

  async function deleteItem(id: string) {
    await supabase.from('shopping_items').delete().eq('id', id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function clearChecked() {
    Alert.alert('Clear checked items?', "This will remove everything you've checked off.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          const checkedIds = items.filter((i) => i.checked).map((i) => i.id);
          await supabase.from('shopping_items').delete().in('id', checkedIds);
          fetchItems();
        },
      },
    ]);
  }

  async function clearAll() {
    Alert.alert('Clear entire list?', 'This will remove all items.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all', style: 'destructive',
        onPress: async () => {
          await supabase.from('shopping_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          fetchItems();
        },
      },
    ]);
  }

  async function clearCategory(category: string | null) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ids = items.filter((i) => !i.checked && i.category === category).map((i) => i.id);
    if (ids.length === 0) return;
    await supabase.from('shopping_items').delete().in('id', ids);
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
  }

  async function organizeList() {
    const unchecked = items.filter((i) => !i.checked);
    if (unchecked.length < 2) return;

    setOrganizing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const endpoint = Platform.OS === 'web' ? '/api/organize' : 'https://forkyeah.vercel.app/api/organize';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: unchecked.map((i) => i.name) }),
      });

      if (!res.ok) throw new Error('Organize failed');
      const { items: organized } = await res.json();

      const uncheckedIds = unchecked.map((i) => i.id);
      await supabase.from('shopping_items').delete().in('id', uncheckedIds);
      await supabase.from('shopping_items').insert(
        organized.map((item: { name: string; category: string }, i: number) => ({
          name: item.name,
          category: item.category,
          position: i,
        }))
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchItems();
    } catch {
      Alert.alert('Error', 'Could not organize list. Try again.');
    } finally {
      setOrganizing(false);
    }
  }

  async function onDragEnd({ data }: { data: ShoppingItem[] }) {
    setItems(data);
    const newUnchecked = data.filter((i) => !i.checked);
    await Promise.all(
      newUnchecked.map((item, index) =>
        supabase.from('shopping_items').update({ position: index }).eq('id', item.id)
      )
    );
  }

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);
  const allDisplayed = [...unchecked, ...checked];

  const hasCategorizedItems = unchecked.some((i) => i.category);
  const getEffectiveCategory = (i: ShoppingItem) =>
    i.category ?? (hasCategorizedItems ? 'Uncategorized' : null);

  const listHeader = items.length > 0 ? (
    <View style={styles.headerActions}>
      {unchecked.length >= 2 && (
        <TouchableOpacity
          style={[styles.organizeBtn, organizing && { opacity: 0.6 }]}
          onPress={organizeList}
          disabled={organizing}
        >
          {organizing ? (
            <ActivityIndicator size="small" color={C.red} />
          ) : (
            <Ionicons name="sparkles-outline" size={15} color={C.red} />
          )}
          <Text style={styles.organizeBtnText}>
            {organizing ? 'Organizing...' : 'Organize list'}
          </Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.clearAllHeaderBtn} onPress={clearAll}>
        <Text style={styles.clearAllHeaderText}>Clear all</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  const listEmpty = (
    <View style={styles.center}>
      <Ionicons name="cart-outline" size={64} color={C.border} />
      <Text style={styles.emptyText}>List is empty</Text>
      <Text style={styles.emptySubtext}>Add items below</Text>
    </View>
  );

  const renderRightActions = (id: string) => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); deleteItem(id); }}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
    </TouchableOpacity>
  );

  const renderWebItem = ({ item, index }: { item: ShoppingItem; index: number }) => {
    const prevItem = allDisplayed[index - 1];
    const effectiveCategory = getEffectiveCategory(item);
    const prevEffectiveCategory = prevItem && !prevItem.checked ? getEffectiveCategory(prevItem) : null;
    const showCategoryHeader =
      !item.checked && effectiveCategory !== null && effectiveCategory !== prevEffectiveCategory;

    return (
      <>
        {showCategoryHeader && (
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryHeaderText}>{effectiveCategory}</Text>
            <TouchableOpacity onPress={() => clearCategory(item.category)}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
        {item.id === checked[0]?.id && checked.length > 0 && (
          <View style={styles.divider}>
            <Text style={styles.dividerText}>In cart ({checked.length})</Text>
            <TouchableOpacity onPress={clearChecked}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity
          style={[styles.itemRow, item.checked && styles.itemRowChecked]}
          onPress={() => toggleItem(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
            {item.checked && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>{item.name}</Text>
        </TouchableOpacity>
      </>
    );
  };

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<ShoppingItem>) => {
    const index = getIndex() ?? 0;
    const prevItem = allDisplayed[index - 1];
    const effectiveCategory = getEffectiveCategory(item);
    const prevEffectiveCategory = prevItem && !prevItem.checked ? getEffectiveCategory(prevItem) : null;
    const showCategoryHeader =
      !item.checked &&
      effectiveCategory !== null &&
      effectiveCategory !== prevEffectiveCategory;

    return (
      <ScaleDecorator>
        <>
          {showCategoryHeader && (
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryHeaderText}>{effectiveCategory}</Text>
              <TouchableOpacity onPress={() => clearCategory(item.category)}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}
          {item.id === checked[0]?.id && checked.length > 0 && (
            <View style={styles.divider}>
              <Text style={styles.dividerText}>In cart ({checked.length})</Text>
              <TouchableOpacity onPress={clearChecked}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}
          <Swipeable renderRightActions={() => renderRightActions(item.id)} overshootRight={false}>
            <TouchableOpacity
              style={[styles.itemRow, item.checked && styles.itemRowChecked, isActive && styles.itemRowDragging]}
              onPress={() => toggleItem(item)}
              activeOpacity={0.7}
            >
              {!item.checked ? (
                <TouchableOpacity onLongPress={drag} delayLongPress={150} hitSlop={8} style={styles.dragHandle}>
                  <Ionicons name="reorder-three-outline" size={22} color={C.border} />
                </TouchableOpacity>
              ) : (
                <View style={styles.dragHandleSpacer} />
              )}
              <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                {item.checked && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>{item.name}</Text>
            </TouchableOpacity>
          </Swipeable>
        </>
      </ScaleDecorator>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={C.red} /></View>
        ) : Platform.OS === 'web' ? (
          <FlatList
            data={allDisplayed}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={renderWebItem}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={listEmpty}
            ListFooterComponent={<View style={{ height: 16 }} />}
          />
        ) : (
          <DraggableFlatList
            data={allDisplayed}
            keyExtractor={(item) => item.id}
            onDragEnd={onDragEnd}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={listEmpty}
            ListFooterComponent={<View style={{ height: 16 }} />}
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Add an item..."
            placeholderTextColor={C.placeholder}
            value={newItem}
            onChangeText={setNewItem}
            onSubmitEditing={addItem}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addBtn} onPress={addItem} disabled={adding}>
            {adding ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="add" size={24} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, paddingTop: 80 },
    list: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
    headerActions: {
      gap: 8, marginBottom: 12,
    },
    organizeBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 10,
      borderRadius: 10, borderWidth: 1, borderColor: C.red, backgroundColor: C.redLight,
    },
    organizeBtnText: { fontSize: 14, color: C.red, fontWeight: '600' },
    clearAllHeaderBtn: {
      alignItems: 'center', paddingVertical: 8,
    },
    clearAllHeaderText: { fontSize: 14, color: C.textMuted },
    categoryHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingTop: 16, paddingBottom: 6,
    },
    categoryHeaderText: {
      fontSize: 11, fontWeight: '700', color: C.red,
      textTransform: 'uppercase', letterSpacing: 1,
    },
    itemRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight,
      gap: 14, backgroundColor: C.bg,
    },
    itemRowChecked: { opacity: 0.5 },
    itemRowDragging: { opacity: 0.85, backgroundColor: C.card },
    dragHandle: { padding: 2 },
    dragHandleSpacer: { width: 26 },
    checkbox: {
      width: 24, height: 24, borderRadius: 12, borderWidth: 2,
      borderColor: C.border, alignItems: 'center', justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: C.red, borderColor: C.red },
    itemName: { fontSize: 16, color: C.text, fontWeight: '500', flex: 1 },
    itemNameChecked: { textDecorationLine: 'line-through' },
    divider: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 12, marginTop: 8,
    },
    dividerText: { fontSize: 12, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    clearText: { fontSize: 13, color: C.red, fontWeight: '600' },
    emptyText: { fontSize: 20, fontWeight: '600', color: C.textMuted, marginTop: 16 },
    emptySubtext: { fontSize: 14, color: C.border, marginTop: 4 },
    deleteAction: {
      backgroundColor: C.swipeDelete, justifyContent: 'center',
      alignItems: 'center', width: 70, borderBottomWidth: 1, borderBottomColor: C.borderLight,
    },
    inputRow: {
      flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10,
      borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg,
    },
    input: {
      flex: 1, backgroundColor: C.inputBg, borderRadius: 12, paddingHorizontal: 16,
      paddingVertical: 13, fontSize: 16, borderWidth: 1, borderColor: C.border, color: C.text,
    },
    addBtn: {
      backgroundColor: C.red, width: 48, height: 48,
      borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    },
  });
}
