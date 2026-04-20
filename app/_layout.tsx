import { Stack } from 'expo-router';
import { Colors } from '../constants/theme';


export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { color: Colors.text },
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create" options={{ headerShown: false }} />
      <Stack.Screen name="join" options={{ headerShown: false }} />
      <Stack.Screen name="game/lobby" options={{ headerShown: false }} />
      <Stack.Screen name="game/area" options={{ headerShown: false }} />
    </Stack>
  );
}