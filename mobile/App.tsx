// 글꼴 패키지의 index는 모든 굵기를 불러오므로 쓰는 굵기만 경로로 가져온다 (한글 글꼴은 굵기마다 약 2.8MB)
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexSansKR_400Regular } from '@expo-google-fonts/ibm-plex-sans-kr/400Regular';
import { IBMPlexSansKR_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-kr/600SemiBold';
import { IBMPlexSansKR_700Bold } from '@expo-google-fonts/ibm-plex-sans-kr/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from './src/components/toast';
import { StoreProvider } from './src/data/store';
import RootNavigator from './src/navigation/RootNavigator';
import { usePalette } from './src/theme';

export default function App() {
  const [loaded, error] = useFonts({
    IBMPlexSansKR_400Regular,
    IBMPlexSansKR_600SemiBold,
    IBMPlexSansKR_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  const c = usePalette();

  // 글꼴을 불러오지 못해도 기본 글꼴로 앱은 연다
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <StoreProvider>
          <RootNavigator />
          <StatusBar style="auto" />
        </StoreProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
