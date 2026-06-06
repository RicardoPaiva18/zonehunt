import { Stack } from 'expo-router';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

function AppStack() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create" options={{ headerShown: false }} />
      <Stack.Screen name="join" options={{ headerShown: false }} />
      <Stack.Screen name="game/lobby" options={{ headerShown: false }} />
      <Stack.Screen name="game/area" options={{ headerShown: false }} />
      <Stack.Screen name="game/place" options={{ headerShown: false }} />
      <Stack.Screen name="game/play" options={{ headerShown: false }} />
      <Stack.Screen name="game/camera" options={{ headerShown: false }} />
      <Stack.Screen name="game/finish" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppStack />
    </ThemeProvider>
  );
}