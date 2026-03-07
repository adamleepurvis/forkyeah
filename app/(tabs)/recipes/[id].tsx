import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
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

      <Text style={styles.sectionLabel}>Ingredients</Text>
      {recipe.ingredients.map((ing, i) => (
        <View key={i} style={styles.ingredientRow}>
          <View style={styles.bullet} />
          <Text style={styles.ingredientText}>
            {[ing.amount, ing.unit, ing.name].filter(Boolean).join(' ')}
          </Text>
        </View>
      ))}

      <Text style={styles.sectionLabel}>Steps</Text>
      {recipe.steps.map((step, i) => (
        <View key={i} style={styles.stepRow}>
          <Text style={styles.stepNumber}>{i + 1}</Text>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}

      {recipe.notes ? (
        <>
          <Text style={styles.sectionLabel}>Notes</Text>
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>{recipe.notes}</Text>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F3',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F3',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A2E',
    flex: 1,
    marginRight: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B35',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6B35',
    marginRight: 12,
  },
  ingredientText: {
    fontSize: 16,
    color: '#1A1A2E',
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B35',
    width: 28,
    marginTop: 1,
  },
  stepText: {
    fontSize: 16,
    color: '#1A1A2E',
    flex: 1,
    lineHeight: 24,
  },
  notesBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E0D8',
  },
  notesText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },
});
