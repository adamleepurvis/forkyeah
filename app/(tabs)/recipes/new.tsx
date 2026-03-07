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
import type { Ingredient } from '../../../lib/types';

export default function NewRecipeScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const isEditing = !!id;

  const [title, setTitle] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { amount: '', unit: '', name: '' },
  ]);
  const [steps, setSteps] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');
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
          setIngredients(data.ingredients.length ? data.ingredients : [{ amount: '', unit: '', name: '' }]);
          setSteps(data.steps.length ? data.steps : ['']);
          setNotes(data.notes ?? '');
        }
        setLoading(false);
      });
  }, [id]);

  function updateIngredient(index: number, field: keyof Ingredient, value: string) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)));
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { amount: '', unit: '', name: '' }]);
  }

  function removeIngredient(index: number) {
    if (ingredients.length === 1) return;
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function updateStep(index: number, value: string) {
    setSteps((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, '']);
  }

  function removeStep(index: number) {
    if (steps.length === 1) return;
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please add a recipe name.');
      return;
    }

    const cleanedIngredients = ingredients.filter((i) => i.name.trim());
    const cleanedSteps = steps.filter((s) => s.trim());

    setSaving(true);
    const payload = {
      title: title.trim(),
      ingredients: cleanedIngredients,
      steps: cleanedSteps,
      notes: notes.trim() || null,
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
      router.back();
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Recipe Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Chicken Tikka Masala"
          placeholderTextColor="#bbb"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.fieldLabel}>Ingredients</Text>
        {ingredients.map((ing, i) => (
          <View key={i} style={styles.ingredientRow}>
            <TextInput
              style={[styles.input, styles.amountInput]}
              placeholder="Amt"
              placeholderTextColor="#bbb"
              value={ing.amount}
              onChangeText={(v) => updateIngredient(i, 'amount', v)}
            />
            <TextInput
              style={[styles.input, styles.unitInput]}
              placeholder="Unit"
              placeholderTextColor="#bbb"
              value={ing.unit}
              onChangeText={(v) => updateIngredient(i, 'unit', v)}
            />
            <TextInput
              style={[styles.input, styles.nameInput]}
              placeholder="Ingredient"
              placeholderTextColor="#bbb"
              value={ing.name}
              onChangeText={(v) => updateIngredient(i, 'name', v)}
            />
            <TouchableOpacity onPress={() => removeIngredient(i)} style={styles.removeBtn}>
              <Ionicons name="remove-circle" size={22} color="#E53935" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={addIngredient}>
          <Ionicons name="add-circle-outline" size={20} color="#FF6B35" />
          <Text style={styles.addRowText}>Add Ingredient</Text>
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>Steps</Text>
        {steps.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{i + 1}</Text>
            <TextInput
              style={[styles.input, styles.stepInput]}
              placeholder={`Step ${i + 1}`}
              placeholderTextColor="#bbb"
              value={step}
              onChangeText={(v) => updateStep(i, v)}
              multiline
            />
            <TouchableOpacity onPress={() => removeStep(i)} style={styles.removeBtn}>
              <Ionicons name="remove-circle" size={22} color="#E53935" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={addStep}>
          <Ionicons name="add-circle-outline" size={20} color="#FF6B35" />
          <Text style={styles.addRowText}>Add Step</Text>
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Serving suggestions, variations, tips..."
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
  container: {
    flex: 1,
    backgroundColor: '#FFF8F3',
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F3',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B35',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E8E0D8',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  amountInput: {
    width: 56,
    marginBottom: 0,
    textAlign: 'center',
  },
  unitInput: {
    width: 64,
    marginBottom: 0,
  },
  nameInput: {
    flex: 1,
    marginBottom: 0,
  },
  removeBtn: {
    padding: 4,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    marginBottom: 4,
  },
  addRowText: {
    fontSize: 15,
    color: '#FF6B35',
    fontWeight: '600',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  stepNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF6B35',
    marginTop: 14,
    width: 20,
  },
  stepInput: {
    flex: 1,
    marginBottom: 0,
    minHeight: 44,
  },
  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
