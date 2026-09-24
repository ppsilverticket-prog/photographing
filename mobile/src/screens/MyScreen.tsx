import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MeetupCard, PostCard } from '../components/cards';
import { Avatar, Banner, Card, Divider, EmptyState, IconButton, Row, Screen, StatBox, Tag, Txt } from '../components/ui';
import { useMe, useStore } from '../data/store';
import { formatShortDate } from '../domain/format';
import { activityLabel, ageLabel } from '../domain/labels';
import { participationRestriction } from '../domain/noShow';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { space, usePalette } from '../theme';

type Props = CompositeScreenProps<BottomTabScreenProps<TabParamList, 'My'>, NativeStackScreenProps<RootStackParamList>>;

export default function MyScreen({ navigation }: Props) {
  const me = useMe();
  const { state, mode, actions } = useStore();
  const c = usePalette();
  const [tab, setTab] = useState<'meetups' | 'posts'>('meetups');
  const now = new Date();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <IconButton icon="settings-outline" label="설정" onPress={() => navigation.navigate('Settings')} />,
    });
  }, [navigation]);

  const restriction = participationRestriction(me.noShowDates.map((d) => new Date(d)), now);
  const myMeetups = state.meetups
    .filter((m) => m.participantIds.includes(me.id) || state.pending.includes(m.id))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const myPosts = state.posts.filter((p) => p.authorId === me.id);

  return (
    <Screen onRefresh={mode === 'server' ? actions.refresh : undefined}>
      <View style={{ gap: space.md }}>
        <Row style={{ gap: space.lg }}>
          <Avatar name={me.name} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Row style={{ gap: 6 }}>
              <Txt variant="heading">{me.name}</Txt>
              {me.foundingHost ? <Tag label="창립 모임장" /> : null}
            </Row>
            <Txt variant="small" tone="muted">
              {[activityLabel[me.type], me.age ? ageLabel[me.age] : null, `서울 ${me.district}`].filter(Boolean).join(' · ')}
            </Txt>
            <Row style={{ gap: 4 }}>
              <Tag label={me.verified ? '본인인증 완료' : '본인인증 전'} tone={me.verified ? 'neutral' : 'warn'} />
            </Row>
          </View>
        </Row>
      </View>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="subheading">
            신뢰도 {me.stats.manner !== null ? me.stats.manner.toFixed(1) : '-'}
          </Txt>
          <Txt variant="caption" tone="muted">
            매너 평가 {me.stats.mannerCount}개
          </Txt>
        </Row>
        <Divider />
        <Row>
          <StatBox value={`${me.stats.attended}회`} label="참석" />
          <StatBox value={`${me.stats.noShows}회`} label="노쇼" />
          <StatBox value={`${me.stats.lateCancels}회`} label="늦은 취소" />
          <StatBox value={`${me.stats.hosted}회`} label="모임 개설" />
        </Row>
        <Txt variant="caption" tone="muted">
          모임이 끝나면 서로 매너를 평가해요. 노쇼와 늦은 취소는 다른 사람에게도 보여요.
        </Txt>
      </Card>

      {restriction.kind === 'blocked' ? (
        <Banner tone="danger" icon="ban-outline">
          최근 90일 노쇼 {restriction.count}회로 {formatShortDate(restriction.until)}까지 모임을 신청할 수 없어요.
        </Banner>
      ) : restriction.kind === 'approvalOnly' ? (
        <Banner tone="warn" icon="alert-circle-outline">
          최근 90일 노쇼가 {restriction.count}회라 당분간 모임장 승인제 모임만 신청할 수 있어요.
        </Banner>
      ) : restriction.kind === 'warning' ? (
        <Banner tone="warn" icon="alert-circle-outline">
          최근 90일 노쇼 {restriction.count}회. 한 번 더 노쇼하면 모임 신청이 제한돼요.
        </Banner>
      ) : null}

      <View style={{ gap: space.md }}>
        <View style={[styles.segment, { borderBottomColor: c.line }]}>
          {(
            [
              ['meetups', `참여 모임 ${myMeetups.length}`],
              ['posts', `내 글 ${myPosts.length}`],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
              onPress={() => setTab(key)}
              style={[styles.segmentItem, { borderBottomColor: tab === key ? c.accent : 'transparent' }]}
            >
              <Txt variant="smallStrong" tone={tab === key ? 'ink' : 'faint'}>
                {label}
              </Txt>
            </Pressable>
          ))}
        </View>

        {tab === 'meetups' ? (
          myMeetups.length === 0 ? (
            <EmptyState icon="calendar-outline" title="아직 참여한 모임이 없어요" body="모임 탭에서 이번 주 출사를 찾아보세요." />
          ) : (
            myMeetups.map((m) => (
              <MeetupCard
                key={m.id}
                meetup={m}
                host={state.members[m.hostId]}
                status={m.participantIds.includes(me.id) ? 'joined' : 'pending'}
                onPress={() => navigation.navigate('MeetupDetail', { id: m.id })}
              />
            ))
          )
        ) : myPosts.length === 0 ? (
          <EmptyState icon="images-outline" title="아직 올린 글이 없어요" body="커뮤니티에서 사진을 올리고 피드백을 받아 보세요." />
        ) : (
          myPosts.map((p) => (
            <PostCard key={p.id} post={p} author={me} now={now} onPress={() => navigation.navigate('PostDetail', { id: p.id })} />
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  segmentItem: { paddingHorizontal: space.md, paddingVertical: space.md, borderBottomWidth: 2 },
});
