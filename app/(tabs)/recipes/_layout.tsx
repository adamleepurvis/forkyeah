import { Stack } from 'expo-router';
import { useColors } from '../../../lib/colors';

export default function RecipesLayout() {
  const C = useColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTitleStyle: { fontWeight: '700', fontSize: 20, color: C.text },
        headerShadowVisible: false,
        headerTintColor: C.red,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Fork Yeah!' }} />
      <Stack.Screen name="new" options={{ title: 'Add Recipe' }} />
      <Stack.Screen name="[id]" options={{ title: 'Recipe' }} />
    </Stack>
  );
}
