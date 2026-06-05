import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
// ▼▼▼ 追加: expo-router から Stack をインポート ▼▼▼
import { Stack } from 'expo-router'; 

import { AnimatedSplashOverlay } from '@/components/animated-icon';
// import AppTabs from '@/components/app-tabs'; // 一旦これはコメントアウト

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      
      {/* ▼▼▼ ここが重要！固定コンポーネントではなく、画面遷移の「枠」を置く ▼▼▼ */}
      <Stack screenOptions={{ headerShown: false }}>
        {/* 必要であれば、ここに各画面の細かい設定を書けます */}
        <Stack.Screen name="index" />
        <Stack.Screen name="signup" />
      </Stack>
      
    </ThemeProvider>
  );
}





// // 1行目のインポート先を @react-navigation/native に変更しました
// import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
// import { useColorScheme } from 'react-native';

// import { AnimatedSplashOverlay } from '@/components/animated-icon';
// import AppTabs from '@/components/app-tabs';


// export default function TabLayout() {
//   const colorScheme = useColorScheme();
//   return (
//     <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
//       <AnimatedSplashOverlay />
//       <AppTabs />
//     </ThemeProvider>
//   );
// }