import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import type { ShoppingItem } from '../../lib/types';

export default function ShoppingScreen() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('shopping_items')
      .select('*')
      .order('created_at');
    if (error) Alert.alert('Error', error.message);
    else setItems(data ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchItems();
    }, [fetchItems])
  );

  async function addItem() {
    const name = newItem.trim();
    if (!name) return;
    setAdding(true);
    const { error } = await supabase.from('shopping_items').insert({ name });
    if (error) Alert.alert('Error', error.message);
    else {
      setNewItem('');
      fetchItems();
    }
    setAdding(false);
  }

  async function toggleItem(item: ShoppingItem) {
    await supabase.from('shopping_items').update({ checked: !item.checked }).eq('id', item.id);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i))
    );
  }

  async function clearChecked() {
    Alert.alert('Clear checked items?', 'This will remove everything you\'ve checked off.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
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
        text: 'Clear all',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('shopping_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          fetchItems();
        },
      },
    ]);
  }

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#CC0000" />
          </View>
        ) : (
          <FlatList
            data={[...unchecked, ...checked]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.center}>
                <Ionicons name="cart-outline" size={64} color="#E8E0D8" />
                <Text style={styles.emptyText}>List is empty</Text>
                <Text style={styles.emptySubtext}>Add items below</Text>
              </View>
            }
            ListHeaderComponent={
              checked.length > 0 ? null : undefined
            }
            renderItem={({ item }) => (
              <>
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
                  <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            ListFooterComponent={
              items.length > 0 ? (
                <TouchableOpacity style={styles.clearAllBtn} onPress={clearAll}>
                  <Text style={styles.clearAllText}>Clear entire list</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Add an item..."
            placeholderTextColor="#bbb"
            value={newItem}
            onChangeText={setNewItem}
            onSubmitEditing={addItem}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addBtn} onPress={addItem} disabled={adding}>
            {adding ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="add" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F3' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, paddingTop: 80 },
  list: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
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
  checkboxChecked: { backgroundColor: '#CC0000', borderColor: '#CC0000' },
  itemName: { fontSize: 16, color: '#1A1A2E', fontWeight: '500', flex: 1 },
  itemNameChecked: { textDecorationLine: 'line-through' },
  divider: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  dividerText: { fontSize: 12, color: '#aaa', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  clearText: { fontSize: 13, color: '#CC0000', fontWeight: '600' },
  clearAllBtn: { marginTop: 24, alignItems: 'center', paddingVertical: 8 },
  clearAllText: { fontSize: 14, color: '#ccc' },
  emptyText: { fontSize: 20, fontWeight: '600', color: '#888', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#bbb', marginTop: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#E8E0D8',
    backgroundColor: '#FFF8F3',
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E8E0D8',
    color: '#1A1A2E',
  },
  addBtn: {
    backgroundColor: '#CC0000',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
