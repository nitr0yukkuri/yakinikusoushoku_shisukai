import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { Slot } from 'expo-router'; // ★追加：Expo Routerの画面枠

import { AnimatedSplashOverlay } from '@/components/animated-icon';
// import AppTabs from '@/components/app-tabs'; // ★一旦コメントアウトか削除

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      
      {/* ★AppTabs の代わりに Slot を配置する */}
      {/* これにより index.tsx や home.tsx がここに表示されるようになります */}
      <Slot /> 

    </ThemeProvider>
  );
}