// Supabase 연결. mobile/.env.local에 두 값이 있으면 서버 모드, 없으면 예시 데이터로 동작한다.
//   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
//   EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_...   (publishable 또는 anon 키. secret 키는 절대 넣지 않는다)
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Expo는 process.env.EXPO_PUBLIC_* 를 빌드할 때 값으로 바꿔 넣는다. 그래서 이 형태 그대로 써야 한다.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

// 앱이 화면에 있을 때만 로그인 토큰을 갱신한다
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => {
    if (status === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const PHOTO_BUCKET = 'post-photos';
