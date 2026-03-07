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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import type { Recipe } from '../../../lib/types';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) Alert.alert('Error', error.message);
        else setRecipe(data);
        setLoading(false);
      });
  }, [id]);

  async function deleteRecipe() {
    Alert.alert('Delete Recipe', `Delete "${recipe?.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('recipes').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!recipe) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{recipe.title}</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(tabs)/recipes/new', params: { id } })}
            style={styles.actionBtn}
          >
            <Ionicons name="pencil-outline" size={20} color="#FF6B35" />
          </TouchableOpacity>
          <TouchableOpacity onPress={deleteRecipe} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={20} color="#E53935" />
          </TouchableOpacity>
        </View>
      </View>

      {recipe.url ? (
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => Linking.openURL(recipe.url!)}
        >
          <Ionicons name="open-outline" size={18} color="#FF6B35" />
          <Text style={styles.linkText}>Open Recipe</Text>
        </TouchableOpacity>
      ) : null}

      {recipe.notes ? (
        <>
          <Text style={styles.sectionLabel}>Notes</Text>
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>{recipe.notes}</Text>
          </View>
        </>
      ) : null}

      {!recipe.url && !recipe.notes ? (
        <Text style={styles.emptyState}>No link or notes added.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F3' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8F3' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#1A1A2E', flex: 1, marginRight: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 8 },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF0E8',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFD4BC',
    marginBottom: 24,
  },
  linkText: { fontSize: 16, fontWeight: '600', color: '#FF6B35' },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B35',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  notesBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E0D8',
  },
  notesText: { fontSize: 15, color: '#555', lineHeight: 22 },
  emptyState: { fontSize: 15, color: '#bbb', textAlign: 'center', marginTop: 40 },
});
