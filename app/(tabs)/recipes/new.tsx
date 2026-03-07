import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import type { Protein, Timing } from '../../../lib/types';

const PROTEINS: { value: Protein; label: string }[] = [
  { value: 'chicken', label: 'Chicken' },
  { value: 'salmon', label: 'Salmon' },
  { value: 'shrimp', label: 'Shrimp' },
  { value: 'beef', label: 'Beef' },
  { value: 'pork', label: 'Pork' },
  { value: 'lamb', label: 'Lamb' },
  { value: 'tofu', label: 'Tofu' },
  { value: 'veggie', label: 'Veggie' },
];

export default function NewRecipeScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const isEditing = !!id;

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [protein, setProtein] = useState<Protein | null>(null);
  const [timing, setTiming] = useState<Timing | null>(null);
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);

  useEffect(() => {
    if (!isEditing) return;
    supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setTitle(data.title);
          setUrl(data.url ?? '');
          setNotes(data.notes ?? '');
          setProtein(data.protein ?? null);
          setTiming(data.timing ?? null);
          setIngredients(data.ingredients?.length ? data.ingredients : ['']);
        }
        setLoading(false);
      });
  }, [id]);

  async function save() {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please add a recipe name.');
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      url: url.trim() || null,
      notes: notes.trim() || null,
      protein,
      timing,
      ingredients: ingredients.map((i) => i.trim()).filter(Boolean),
    };

    let error;
    if (isEditing) {
      ({ error } = await supabase.from('recipes').update(payload).eq('id', id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      ({ error } = await supabase.from('recipes').insert({ ...payload, created_by: user!.id }));
    }

    setSaving(false);
    if (error) Alert.alert('Error', error.message);
    else router.back();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#CC0000" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Recipe Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Chicken Tikka Masala"
          placeholderTextColor="#bbb"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.fieldLabel}>Recipe Link (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="https://cooking.nytimes.com/..."
          placeholderTextColor="#bbb"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
        />

        <Text style={styles.fieldLabel}>Protein</Text>
        <View style={styles.chipWrap}>
          {PROTEINS.map(({ value, label }) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, protein === value && styles.chipActive]}
              onPress={() => setProtein(protein === value ? null : value)}
            >
              <Text style={[styles.chipText, protein === value && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Timing</Text>
        <View style={styles.timingRow}>
          <TouchableOpacity
            style={[styles.timingBtn, timing === 'weekday' && styles.timingBtnActive]}
            onPress={() => setTiming(timing === 'weekday' ? null : 'weekday')}
          >
            <Text style={[styles.timingText, timing === 'weekday' && styles.timingTextActive]}>
              Weekday
            </Text>
            <Text style={[styles.timingSubtext, timing === 'weekday' && styles.timingTextActive]}>
              Quick, 30–45 min
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timingBtn, timing === 'weekend' && styles.timingBtnActive]}
            onPress={() => setTiming(timing === 'weekend' ? null : 'weekend')}
          >
            <Text style={[styles.timingText, timing === 'weekend' && styles.timingTextActive]}>
              Weekend
            </Text>
            <Text style={[styles.timingSubtext, timing === 'weekend' && styles.timingTextActive]}>
              More time needed
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>Ingredients (optional)</Text>
        {ingredients.map((ing, i) => (
          <View key={i} style={styles.ingredientRow}>
            <TextInput
              style={[styles.input, styles.ingredientInput]}
              placeholder={`e.g. 2 chicken breasts`}
              placeholderTextColor="#bbb"
              value={ing}
              onChangeText={(v) => setIngredients((prev) => prev.map((x, j) => j === i ? v : x))}
              onSubmitEditing={() => setIngredients((prev) => [...prev, ''])}
              returnKeyType="next"
            />
            {ingredients.length > 1 && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => setIngredients((prev) => prev.filter((_, j) => j !== i))}
              >
                <Ionicons name="remove-circle" size={22} color="#E53935" />
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={() => setIngredients((prev) => [...prev, ''])}>
          <Ionicons name="add-circle-outline" size={18} color="#CC0000" />
          <Text style={styles.addRowText}>Add ingredient</Text>
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="e.g. halve the recipe, sub tofu, great for leftovers..."
          placeholderTextColor="#bbb"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Add Recipe'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F3' },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8F3' },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CC0000',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E8E0D8',
    color: '#1A1A2E',
  },
  notesInput: { minHeight: 100, textAlignVertical: 'top' },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  ingredientInput: { flex: 1, marginBottom: 0 },
  removeBtn: { padding: 2 },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, marginBottom: 4 },
  addRowText: { fontSize: 15, color: '#CC0000', fontWeight: '600' },
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
  timingRow: { flexDirection: 'row', gap: 12 },
  timingBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E0D8',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  timingBtnActive: { backgroundColor: '#CC0000', borderColor: '#CC0000' },
  timingText: { fontSize: 15, fontWeight: '700', color: '#555' },
  timingSubtext: { fontSize: 11, color: '#aaa', marginTop: 2 },
  timingTextActive: { color: '#fff' },
  saveButton: {
    backgroundColor: '#CC0000',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
