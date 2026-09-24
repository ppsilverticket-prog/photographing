import { useColorScheme } from 'react-native';

// 와이어프레임 v0.1·랜딩 페이지와 같은 팔레트
const light = {
  bg: '#FFFFFF',
  surface: '#F3F1ED',
  ink: '#1F1D1A',
  muted: '#5F5A54',
  faint: '#8A847C',
  line: '#D9D5CF',
  accent: '#0F6E63',
  accentInk: '#0B5249',
  accentSoft: '#DDEFEC',
  onAccent: '#FFFFFF',
  warn: '#8A5A00',
  warnSoft: '#FBEFD6',
  danger: '#B3261E',
  dangerSoft: '#FBE4E2',
};

export type Palette = typeof light;

const dark: Palette = {
  bg: '#141312',
  surface: '#1E1C1A',
  ink: '#EDEAE4',
  muted: '#ABA59C',
  faint: '#857F77',
  line: '#34312D',
  accent: '#5BBFB0',
  accentInk: '#86D6CA',
  accentSoft: '#17332F',
  onAccent: '#0B1F1C',
  warn: '#E0B566',
  warnSoft: '#3A2E17',
  danger: '#F2B8B5',
  dangerSoft: '#3D1F1D',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const fonts = {
  regular: 'IBMPlexSansKR_400Regular',
  // 앱 용량을 줄이려고 500 굵기는 싣지 않고 600으로 대신한다
  medium: 'IBMPlexSansKR_600SemiBold',
  semibold: 'IBMPlexSansKR_600SemiBold',
  bold: 'IBMPlexSansKR_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
