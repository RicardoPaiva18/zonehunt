import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { Colors, LightColors, darkMapStyle, lightMapStyle } from '../constants/theme';
import type { AppColors } from '../constants/theme';

type ThemeContextType = {
  isDark: boolean;
  toggleTheme: () => void;
  colors: AppColors;
  mapStyle: typeof darkMapStyle;
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  toggleTheme: () => {},
  colors: Colors,
  mapStyle: darkMapStyle,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('zonehunt_theme').then((val) => {
      if (val === 'light') setIsDark(false);
    });
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem('zonehunt_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{
      isDark,
      toggleTheme,
      colors: isDark ? Colors : LightColors,
      mapStyle: isDark ? darkMapStyle : lightMapStyle,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}