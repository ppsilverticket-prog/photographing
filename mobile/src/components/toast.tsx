// 화면 아래에 잠깐 떴다 사라지는 안내. 서버 요청의 성공·실패를 알려 준다.
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, radius, space, usePalette } from '../theme';

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const c = usePalette();

  const show = useCallback((next: string) => {
    setMessage(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3500);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 84 }]}>
          <View style={[styles.toast, { backgroundColor: c.ink }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Text style={[styles.text, { color: c.bg }]}>{message}</Text>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.xl, right: space.xl, alignItems: 'center' },
  toast: { paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md, maxWidth: 420 },
  text: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
});
