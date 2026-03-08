import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../lib/supabase';
import { useColors, type Colors } from '../../../lib/colors';
import type { Protein, Timing } from '../../../lib/types';
import { scrapeRecipe } from '../../../lib/scrapeRecipe';

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
  const C = useColors();
  const styles = makeStyles(C);

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [protein, setProtein] = useState<Protein | null>(null);
  const [timing, setTiming] = useState<Timing | null>(null);
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const hasScraped = useRef(false);

  async function fetchFromLink() {
    if (!url.trim()) return;
    setScraping(true);
    const scraped = await scrapeRecipe(url.trim());
    setScraping(false);
    hasScraped.current = true;

    let didFill = false;
    if (scraped.title && !title.trim()) { setTitle(scraped.title); didFill = true; }
    if (scraped.ingredients?.length && ingredients.every((i) => !i.trim())) {
      setIngredients(scraped.ingredients);
      didFill = true;
    }
    if (scraped.protein && !protein) { setProtein(scraped.protein); didFill = true; }
    if (scraped.timing && !timing) { setTiming(scraped.timing); didFill = true; }

    if (didFill) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('Nothing found', 'Could not extract recipe details from this link. Try filling in the fields manually.');
    }
  }

  useEffect(() => {
    if (!isEditing) return;
    supabase.from('recipes').select('*').eq('id', id).single().then(({ data }) => {
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
    // For new recipes with a URL: scrape first, populate empty fields, let user review
    if (!isEditing && url.trim() && !hasScraped.current) {
      setScraping(true);
      const scraped = await scrapeRecipe(url.trim());
      setScraping(false);
      hasScraped.current = true;

      let didFill = false;
      if (scraped.title && !title.trim()) { setTitle(scraped.title); didFill = true; }
      if (scraped.ingredients?.length && ingredients.every((i) => !i.trim())) {
        setIngredients(scraped.ingredients);
        didFill = true;
      }
      if (scraped.protein && !protein) { setProtein(scraped.protein); didFill = true; }
      if (scraped.timing && !timing) { setTiming(scraped.timing); didFill = true; }

      if (didFill) {
        Alert.alert('Recipe info found', 'We auto-filled details from the link. Review and tap Save to confirm.');
        return;
      }
      // Nothing found — fall through to save normally
    }

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
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={C.red} /></View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isEditing ? 'Edit Recipe' : 'Add Recipe' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Recipe Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Chicken Tikka Masala"
          placeholderTextColor={C.placeholder}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.fieldLabel}>Recipe Link (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="https://cooking.nytimes.com/..."
          placeholderTextColor={C.placeholder}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
        />

        {url.trim() ? (
          <TouchableOpacity style={styles.fetchBtn} onPress={fetchFromLink} disabled={scraping}>
            {scraping
              ? <ActivityIndicator size="small" color={C.red} />
              : <><Ionicons name="sparkles-outline" size={15} color={C.red} /><Text style={styles.fetchBtnText}>Fetch details from link</Text></>
            }
          </TouchableOpacity>
        ) : null}

        <Text style={styles.fieldLabel}>Protein</Text>
        <View style={styles.chipWrap}>
          {PROTEINS.map(({ value, label }) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, protein === value && styles.chipActive]}
              onPress={() => setProtein(protein === value ? null : value)}
            >
              <Text style={[styles.chipText, protein === value && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Timing</Text>
        <View style={styles.timingRow}>
          <TouchableOpacity
            style={[styles.timingBtn, timing === 'weekday' && styles.timingBtnActive]}
            onPress={() => setTiming(timing === 'weekday' ? null : 'weekday')}
          >
            <Text style={[styles.timingText, timing === 'weekday' && styles.timingTextActive]}>Weekday</Text>
            <Text style={[styles.timingSubtext, timing === 'weekday' && styles.timingTextActive]}>Quick, 30–45 min</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timingBtn, timing === 'weekend' && styles.timingBtnActive]}
            onPress={() => setTiming(timing === 'weekend' ? null : 'weekend')}
          >
            <Text style={[styles.timingText, timing === 'weekend' && styles.timingTextActive]}>Weekend</Text>
            <Text style={[styles.timingSubtext, timing === 'weekend' && styles.timingTextActive]}>More time needed</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>Ingredients (optional)</Text>
        {ingredients.map((ing, i) => (
          <View key={i} style={styles.ingredientRow}>
            <TextInput
              style={[styles.input, styles.ingredientInput]}
              placeholder="e.g. 2 chicken breasts"
              placeholderTextColor={C.placeholder}
              value={ing}
              onChangeText={(v) => setIngredients((prev) => prev.map((x, j) => j === i ? v : x))}
              onSubmitEditing={() => setIngredients((prev) => [...prev, ''])}
              returnKeyType="next"
            />
            {ingredients.length > 1 && (
              <TouchableOpacity style={styles.removeBtn} onPress={() => setIngredients((prev) => prev.filter((_, j) => j !== i))}>
                <Ionicons name="remove-circle" size={22} color="#E53935" />
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={() => setIngredients((prev) => [...prev, ''])}>
          <Ionicons name="add-circle-outline" size={18} color={C.red} />
          <Text style={styles.addRowText}>Add ingredient</Text>
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="e.g. halve the recipe, sub tofu, great for leftovers..."
          placeholderTextColor={C.placeholder}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving || scraping}>
          {saving || scraping ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : hasScraped.current ? 'Save Recipe' : 'Add Recipe'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 20, paddingBottom: 48 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
    fieldLabel: {
      fontSize: 13, fontWeight: '700', color: C.red,
      textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 20,
    },
    input: {
      backgroundColor: C.inputBg, borderRadius: 10, paddingHorizontal: 14,
      paddingVertical: 14, fontSize: 15, borderWidth: 1, borderColor: C.border, color: C.text,
    },
    notesInput: { minHeight: 100, textAlignVertical: 'top' },
    ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    ingredientInput: { flex: 1, marginBottom: 0 },
    removeBtn: { padding: 2 },
    addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, marginBottom: 4 },
    addRowText: { fontSize: 15, color: C.red, fontWeight: '600' },
    fetchBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, marginTop: 8, paddingVertical: 10, borderRadius: 10,
      borderWidth: 1, borderColor: C.red, backgroundColor: C.redLight,
    },
    fetchBtnText: { fontSize: 14, color: C.red, fontWeight: '600' },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.chipBg,
    },
    chipActive: { backgroundColor: C.red, borderColor: C.red },
    chipText: { fontSize: 14, color: C.textSec, fontWeight: '600' },
    chipTextActive: { color: '#fff' },
    timingRow: { flexDirection: 'row', gap: 12 },
    timingBtn: {
      flex: 1, padding: 14, borderRadius: 12, borderWidth: 1,
      borderColor: C.border, backgroundColor: C.card, alignItems: 'center',
    },
    timingBtnActive: { backgroundColor: C.red, borderColor: C.red },
    timingText: { fontSize: 15, fontWeight: '700', color: C.textSec },
    timingSubtext: { fontSize: 11, color: C.textMuted, marginTop: 2 },
    timingTextActive: { color: '#fff' },
    saveButton: {
      backgroundColor: C.red, borderRadius: 14, paddingVertical: 16,
      alignItems: 'center', marginTop: 32,
    },
    saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  });
}
