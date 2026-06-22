import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable } from 'react-native';
import { useColors } from '../../lib/colors';

export default function TabsLayout() {
  const C = useColors();
  return (
    <Tabs
      initialRouteName="planner"
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTitleStyle: { fontWeight: '700', fontSize: 20, color: C.text },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.border },
        tabBarActiveTintColor: C.red,
        tabBarInactiveTintColor: C.textMuted,
        // On web, use Pressable instead of anchor tags so iOS PWA stays in standalone mode
        ...(Platform.OS === 'web' && {
          tabBarButton: ({ onPress, children, style, accessibilityState }: any) => (
            <Pressable onPress={onPress} style={style} accessibilityState={accessibilityState}>
              {children}
            </Pressable>
          ),
        }),
      }}
    >
      <Tabs.Screen
        name="planner"
        options={{
          title: 'Planner',
          headerTitle: 'Planner',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Recipes',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: 'Shopping',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
