import { Stack } from 'expo-router';

export default function RecipesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFF8F3' },
        headerTitleStyle: { fontWeight: '700', fontSize: 20, color: '#1A1A2E' },
        headerShadowVisible: false,
        headerTintColor: '#CC0000',
      }}
    />
  );
}
