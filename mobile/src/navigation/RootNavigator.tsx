import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../data/store';
import ChatScreen from '../screens/ChatScreen';
import CommunityScreen from '../screens/CommunityScreen';
import ComposeScreen from '../screens/ComposeScreen';
import CreateMeetupScreen from '../screens/CreateMeetupScreen';
import ExploreScreen from '../screens/ExploreScreen';
import GuidelinesScreen from '../screens/GuidelinesScreen';
import HomeScreen from '../screens/HomeScreen';
import MeetupDetailScreen from '../screens/MeetupDetailScreen';
import MyScreen from '../screens/MyScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import ReportScreen from '../screens/ReportScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { fonts, usePalette } from '../theme';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const tabIcons: Record<keyof TabParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Home: ['home', 'home-outline'],
  Explore: ['map', 'map-outline'],
  Community: ['chatbubbles', 'chatbubbles-outline'],
  My: ['person', 'person-outline'],
};

function Tabs() {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 18 },
        headerShadowVisible: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.faint,
        // 기본 탭 바 높이(49)에서는 아이콘(28) 아래 한글 탭 이름이 7px로 눌려 잘린다. 아이콘 28 + 이름 15 + 여백이 들어가게 60으로 둔다
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 15 },
        tabBarStyle: {
          borderTopColor: c.line,
          height: 60 + insets.bottom,
          paddingTop: 0,
          paddingBottom: insets.bottom || 4,
        },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={tabIcons[route.name][focused ? 0 : 1]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '포토그래핑', tabBarLabel: '홈' }} />
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ title: '출사 모임', tabBarLabel: '모임' }} />
      <Tab.Screen name="Community" component={CommunityScreen} options={{ title: '커뮤니티', tabBarLabel: '커뮤니티' }} />
      <Tab.Screen name="My" component={MyScreen} options={{ title: 'MY', tabBarLabel: 'MY' }} />
    </Tab.Navigator>
  );
}

function useNavigationTheme(): Theme {
  const scheme = useColorScheme();
  const c = usePalette();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.accent,
      background: c.bg,
      card: c.bg,
      text: c.ink,
      border: c.line,
      notification: c.danger,
    },
    fonts: {
      regular: { fontFamily: fonts.regular, fontWeight: 'normal' },
      medium: { fontFamily: fonts.medium, fontWeight: 'normal' },
      bold: { fontFamily: fonts.bold, fontWeight: 'normal' },
      heavy: { fontFamily: fonts.bold, fontWeight: 'normal' },
    },
  };
}

export default function RootNavigator() {
  const { state } = useStore();
  const theme = useNavigationTheme();
  const signedIn = state.me !== null;

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        {signedIn ? (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="MeetupDetail" component={MeetupDetailScreen} options={{ title: '모임' }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: '모임 채팅' }} />
            <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: '' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '설정' }} />
            <Stack.Screen name="Guidelines" component={GuidelinesScreen} options={{ title: '커뮤니티 가이드라인' }} />
            <Stack.Group screenOptions={{ presentation: 'modal' }}>
              <Stack.Screen name="CreateMeetup" component={CreateMeetupScreen} options={{ title: '모임 만들기' }} />
              <Stack.Screen name="Compose" component={ComposeScreen} options={{ title: '사진 올리기' }} />
              <Stack.Screen name="Report" component={ReportScreen} options={{ title: '신고하기' }} />
            </Stack.Group>
          </>
        ) : (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Guidelines" component={GuidelinesScreen} options={{ title: '커뮤니티 가이드라인' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
