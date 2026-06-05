import { Redirect } from 'expo-router';

export default function Index() {
  // アプリが起動したら、自動的に /home (src/app/home.tsx) に転送する
  return <Redirect href="/home" />;
}