import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';

import { MeetupCard, PostCard } from '../components/cards';
import { Banner, Card, Row, Screen, Section, Tag, Txt } from '../components/ui';
import { guidesByAge } from '../data/mock';
import { useMe, useStore, useVisible } from '../data/store';
import { activityLabel, ageLabel } from '../domain/labels';
import { isEligible, seatsLeft } from '../domain/meetupRules';
import type { Meetup } from '../domain/types';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { space } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function HomeScreen({ navigation }: Props) {
  const me = useMe();
  const { state, mode, actions } = useStore();
  const visible = useVisible();
  const now = new Date();

  // 열린 모임이 먼저. 내 지역·관심 장르가 맞는 모임을 위로 올린다
  const score = (m: Meetup) =>
    (m.place.district === me.district ? 2 : 0) + (m.genres.some((g) => me.genres.includes(g)) ? 1 : 0);
  const meetups = visible.meetups
    .filter((m) => new Date(m.startsAt) > now && seatsLeft(m) > 0 && isEligible(m, me))
    .sort((a, b) => score(b) - score(a) || a.startsAt.localeCompare(b.startsAt))
    .slice(0, 3);

  const waiting = visible.posts
    .filter((p) => p.board === 'feedback' && p.answers.length === 0 && p.authorId !== me.id)
    .slice(0, 2);

  const statusOf = (id: string) =>
    state.meetups.find((m) => m.id === id)?.participantIds.includes(me.id)
      ? ('joined' as const)
      : state.pending.includes(id)
        ? ('pending' as const)
        : undefined;

  return (
    <Screen onRefresh={mode === 'server' ? actions.refresh : undefined}>
      {!me.verified ? (
        <Banner tone="warn" icon="shield-outline">
          본인인증 전이에요. 인증을 마치면 모임에 참여하고, 모임을 열고, 글을 쓸 수 있어요.
        </Banner>
      ) : null}
      <Card style={{ paddingVertical: space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">
              {[activityLabel[me.type], me.age ? ageLabel[me.age] : null, `서울 ${me.district}`].filter(Boolean).join(' · ')}
            </Txt>
            <Txt variant="caption" tone="muted">
              기준으로 추천해요
            </Txt>
          </View>
          <Txt variant="smallStrong" tone="accent" onPress={() => navigation.navigate('Settings')}>
            변경
          </Txt>
        </Row>
      </Card>

      <Section title="이번 주 열린 출사 모임" action="전체 보기" onAction={() => navigation.navigate('Explore')}>
        {meetups.length === 0 ? (
          <Txt tone="muted">지금 신청할 수 있는 모임이 없어요. 직접 열어 보는 건 어때요?</Txt>
        ) : (
          meetups.map((m) => (
            <MeetupCard
              key={m.id}
              meetup={m}
              host={state.members[m.hostId]}
              status={statusOf(m.id)}
              onPress={() => navigation.navigate('MeetupDetail', { id: m.id })}
            />
          ))
        )}
      </Section>

      {me.age ? (
        <Section title={`${ageLabel[me.age]} ${activityLabel[me.type]}를 위한 정보`}>
          {guidesByAge[me.age].map((g) => (
            <Card key={g.title} style={{ gap: 6 }}>
              <Tag label={g.tag} tone="neutral" />
              <Txt variant="bodyStrong">{g.title}</Txt>
            </Card>
          ))}
        </Section>
      ) : null}

      <Section title="피드백을 기다리는 사진" action="더 보기" onAction={() => navigation.navigate('Community')}>
        {waiting.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            author={state.members[p.authorId]}
            now={now}
            onPress={() => navigation.navigate('PostDetail', { id: p.id })}
          />
        ))}
      </Section>
    </Screen>
  );
}
