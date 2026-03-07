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
import { supabase } from '../../../lib/supabase';

export default function NewRecipeScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const isEditing = !!id;

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
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
          setUrl(data.url ?? '');
          setNotes(data.notes ?? '');
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
  saveButton: {
    backgroundColor: '#CC0000',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
