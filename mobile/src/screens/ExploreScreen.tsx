import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MeetupCard } from '../components/cards';
import { Chip, EmptyState, Row, Txt } from '../components/ui';
import { ME, useMe, useStore, useVisible } from '../data/store';
import { isThisWeekend } from '../domain/format';
import { isEligible } from '../domain/meetupRules';
import type { Meetup } from '../domain/types';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { fonts, radius, space, usePalette } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Explore'>,
  NativeStackScreenProps<RootStackParamList>
>;

type FilterKey = 'weekend' | 'district' | 'welcome' | 'free' | 'instant' | 'eligible';

export default function ExploreScreen({ navigation }: Props) {
  const me = useMe();
  const { state } = useStore();
  const { meetups } = useVisible();
  const c = usePalette();
  const [filters, setFilters] = useState<FilterKey[]>([]);
  const now = new Date();

  const labels: Record<FilterKey, string> = {
    weekend: '이번 주말',
    district: me.district,
    welcome: '입문 환영',
    free: '무료',
    instant: '바로 참여',
    eligible: '내가 갈 수 있는',
  };

  const tests: Record<FilterKey, (m: Meetup) => boolean> = {
    weekend: (m) => isThisWeekend(new Date(m.startsAt), now),
    district: (m) => m.place.district === me.district,
    welcome: (m) => m.difficulty === 'welcome',
    free: (m) => m.fee.type === 'free',
    instant: (m) => !m.approval,
    eligible: (m) => isEligible(m, me),
  };

  const list = meetups
    .filter((m) => new Date(m.endsAt) > now)
    .filter((m) => filters.every((f) => tests[f](m)))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const byDistrict = list.reduce<Record<string, number>>((acc, m) => {
    acc[m.place.district] = (acc[m.place.district] ?? 0) + 1;
    return acc;
  }, {});

  const toggle = (f: FilterKey) =>
    setFilters((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.xl, paddingVertical: space.md, gap: space.sm }}
        >
          {(Object.keys(labels) as FilterKey[]).map((f) => (
            <Chip key={f} label={labels[f]} selected={filters.includes(f)} onPress={() => toggle(f)} />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: space.xl, gap: space.lg }}>
          {/* 지도 자리. 카카오맵은 개발 빌드에서 붙인다. 기기 위치는 쓰지 않는다 (운영정책 D1) */}
          <View style={[styles.map, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Row style={{ gap: 6 }}>
              <Ionicons name="map-outline" size={16} color={c.muted} />
              <Txt variant="smallStrong" tone="muted">
                지역별 모임
              </Txt>
            </Row>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {Object.entries(byDistrict).map(([d, n]) => (
                <View key={d} style={[styles.pin, { backgroundColor: c.bg, borderColor: c.line }]}>
                  <Txt variant="small">{d}</Txt>
                  <Txt variant="smallStrong" tone="accent" style={{ fontVariant: ['tabular-nums'] }}>
                    {n}
                  </Txt>
                </View>
              ))}
            </View>
            <Txt variant="caption" tone="faint">
              지도 보기는 카카오맵을 연결한 뒤 열려요.
            </Txt>
          </View>

          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="subheading">
              모임 <Txt variant="subheading" tone="accent">{list.length}</Txt>
            </Txt>
            <Txt variant="small" tone="muted">
              시간 순
            </Txt>
          </Row>

          {list.length === 0 ? (
            <EmptyState icon="search-outline" title="조건에 맞는 모임이 없어요" body="필터를 줄이거나 직접 모임을 열어 보세요." />
          ) : (
            list.map((m) => (
              <MeetupCard
                key={m.id}
                meetup={m}
                host={state.members[m.hostId]}
                status={
                  m.participantIds.includes(ME) ? 'joined' : state.pending.includes(m.id) ? 'pending' : undefined
                }
                onPress={() => navigation.navigate('MeetupDetail', { id: m.id })}
              />
            ))
          )}
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('CreateMeetup')}
        style={({ pressed }) => [styles.fab, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
      >
        <Ionicons name="add" size={20} color={c.onAccent} />
        <Txt style={{ color: c.onAccent, fontFamily: fonts.semibold }}>모임 만들기</Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  pin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  fab: {
    position: 'absolute',
    right: space.xl,
    bottom: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    height: 48,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
