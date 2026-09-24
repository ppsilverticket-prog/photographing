import Ionicons from '@expo/vector-icons/Ionicons';
import { useLayoutEffect, useState } from 'react';
import { View } from 'react-native';

import { feeText } from '../components/cards';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Divider,
  EmptyState,
  IconButton,
  InlineConfirm,
  Row,
  Screen,
  Section,
  Tag,
  Txt,
} from '../components/ui';
import { ME, useMe, useStore } from '../data/store';
import { formatRange, formatShortDate } from '../domain/format';
import { activityLabel, ageLabel, difficultyLabel, kindLabel } from '../domain/labels';
import { isEligible, seatsLeft } from '../domain/meetupRules';
import { canRequestToJoin, classifyCancellation, participationRestriction } from '../domain/noShow';
import type { ActivityType } from '../domain/types';
import type { RootScreenProps } from '../navigation/types';
import { space, usePalette } from '../theme';

export default function MeetupDetailScreen({ route, navigation }: RootScreenProps<'MeetupDetail'>) {
  const me = useMe();
  const { state, actions } = useStore();
  const c = usePalette();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const meetup = state.meetups.find((m) => m.id === route.params.id);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <IconButton icon="ellipsis-horizontal" label="더 보기" onPress={() => setMenuOpen((v) => !v)} />,
    });
  }, [navigation]);

  if (!meetup) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="모임을 찾을 수 없어요" body="삭제됐거나 차단한 사람의 모임이에요." />
      </Screen>
    );
  }

  const host = state.members[meetup.hostId];
  const now = new Date();
  const start = new Date(meetup.startsAt);
  const end = new Date(meetup.endsAt);
  const isHost = meetup.hostId === ME;
  const joined = meetup.participantIds.includes(ME);
  const pending = state.pending.includes(meetup.id);
  const left = seatsLeft(meetup);
  const eligible = isEligible(meetup, me);
  const restriction = participationRestriction(me.noShowDates.map((d) => new Date(d)), now);
  const lateNow = classifyCancellation(start, now) === 'late';

  const participants = meetup.participantIds.map((id) => state.members[id]).filter(Boolean);
  const composition = (['beginner', 'amateur', 'student', 'pro'] as ActivityType[])
    .map((t) => [t, participants.filter((p) => p.type === t).length] as const)
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `${activityLabel[t]} ${n}`)
    .join(' · ');

  const target =
    [
      meetup.targetTypes.length ? meetup.targetTypes.map((t) => activityLabel[t]).join(' · ') : '누구나',
      meetup.targetAges.length ? meetup.targetAges.map((a) => ageLabel[a]).join(' · ') : null,
    ]
      .filter(Boolean)
      .join(' / ');

  const info: [keyof typeof Ionicons.glyphMap, string, string][] = [
    ['time-outline', '일시', formatRange(start, end)],
    ['location-outline', '장소', `${meetup.place.name} · 서울 ${meetup.place.district}`],
    [
      'people-outline',
      '인원',
      `${meetup.participantIds.length} / ${meetup.capacity}명 · ${meetup.approval ? '모임장 승인 후 확정' : '신청하면 바로 확정'}`,
    ],
    ['person-circle-outline', '대상', target],
    ['wallet-outline', '참가비', meetup.fee.type === 'free' ? '무료 · 개인 비용 각자' : `${feeText(meetup)} · ${meetup.fee.note}`],
  ];

  const footer = (() => {
    if (end < now) return <Button label="끝난 모임이에요" disabled onPress={() => {}} />;
    if (isHost || joined) {
      return (
        <View style={{ gap: space.sm }}>
          {confirmCancel ? (
            <InlineConfirm
              message={
                lateNow
                  ? '시작 24시간 이내라 지금 취소하면 늦은 취소로 기록돼요. 모임장과 다른 참여자에게도 알려져요.'
                  : '참여를 취소할까요? 시작 24시간 전이라 기록은 남지 않아요.'
              }
              confirmLabel="참여 취소"
              onConfirm={() => {
                actions.cancel(meetup.id);
                setConfirmCancel(false);
              }}
              onCancel={() => setConfirmCancel(false)}
            />
          ) : null}
          <Row>
            <Button
              label="모임 채팅"
              icon="chatbubbles-outline"
              onPress={() => navigation.navigate('Chat', { meetupId: meetup.id })}
              style={{ flex: 1 }}
            />
            {!isHost && !confirmCancel ? (
              <Button label="참여 취소" variant="secondary" onPress={() => setConfirmCancel(true)} />
            ) : null}
          </Row>
        </View>
      );
    }
    if (pending) {
      return (
        <View style={{ gap: space.sm }}>
          <Row>
            <Button label="모임장 승인 대기 중" disabled onPress={() => {}} style={{ flex: 1 }} />
            <Button label="신청 취소" variant="secondary" onPress={() => actions.cancel(meetup.id)} />
          </Row>
          <Button label="프로토타입: 승인된 것으로 보기" variant="ghost" onPress={() => actions.approvePending(meetup.id)} />
        </View>
      );
    }
    if (left === 0) return <Button label="마감됐어요" disabled onPress={() => {}} />;
    if (!eligible) return <Button label="이 모임의 대상이 아니에요" disabled onPress={() => {}} />;
    if (!canRequestToJoin(restriction, meetup.approval)) {
      const label =
        restriction.kind === 'blocked'
          ? `${formatShortDate(restriction.until)}까지 신청할 수 없어요`
          : '승인제 모임만 신청할 수 있어요';
      return <Button label={label} disabled onPress={() => {}} />;
    }
    return (
      <Button
        label={meetup.approval ? '참여 신청하기' : '바로 참여하기'}
        onPress={() => actions.join(meetup.id)}
        accessibilityHint={meetup.approval ? '모임장이 승인하면 참여가 확정돼요' : '누르면 바로 참여가 확정돼요'}
      />
    );
  })();

  return (
    <Screen footer={footer}>
      {menuOpen ? (
        <Card style={{ gap: 0, paddingVertical: space.xs }}>
          <Button
            label="이 모임 신고하기"
            variant="ghost"
            icon="flag-outline"
            onPress={() => {
              setMenuOpen(false);
              navigation.navigate('Report', { kind: 'meetup', id: meetup.id });
            }}
          />
          {!isHost && host ? (
            <Button
              label={`${host.name} 님 차단하기`}
              variant="ghost"
              icon="ban-outline"
              onPress={() => {
                actions.block(host.id);
                navigation.goBack();
              }}
            />
          ) : null}
        </Card>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Row style={{ flexWrap: 'wrap', gap: 6 }}>
          <Tag label={kindLabel[meetup.kind]} tone="neutral" />
          <Tag label={difficultyLabel[meetup.difficulty]} tone={meetup.difficulty === 'welcome' ? 'accent' : 'warn'} />
          <Tag label={feeText(meetup)} tone="neutral" />
          <Tag label={meetup.approval ? '승인제' : '바로 참여'} tone="neutral" />
        </Row>
        <Txt variant="title">{meetup.title}</Txt>
      </View>

      {restriction.kind === 'warning' ? (
        <Banner tone="warn" icon="alert-circle-outline">
          최근 90일 동안 노쇼가 {restriction.count}회 있어요. 한 번 더 노쇼하면 모임 신청이 제한돼요.
        </Banner>
      ) : null}
      {pending ? (
        <Banner tone="info" icon="hourglass-outline">
          참여를 신청했어요. 모임장이 확인하면 알려드려요.
        </Banner>
      ) : null}

      <View style={{ gap: space.md }}>
        {info.map(([icon, label, value]) => (
          <Row key={label} style={{ alignItems: 'flex-start', gap: space.md }}>
            <Ionicons name={icon} size={18} color={c.muted} style={{ marginTop: 2 }} />
            <Txt variant="small" tone="muted" style={{ width: 44, marginTop: 1 }}>
              {label}
            </Txt>
            <Txt style={{ flex: 1 }}>{value}</Txt>
          </Row>
        ))}
      </View>

      {host ? (
        <Card>
          <Row style={{ gap: space.md }}>
            <Avatar name={host.name} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <Row style={{ gap: 6 }}>
                <Txt variant="bodyStrong">{host.name}</Txt>
                {host.foundingHost ? <Tag label="창립 모임장" /> : null}
              </Row>
              <Txt variant="caption" tone="muted">
                {activityLabel[host.type]} · {ageLabel[host.age]}
              </Txt>
            </View>
          </Row>
          <Divider />
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="small" tone="muted">
              신뢰도 <Txt variant="smallStrong">{host.stats.manner?.toFixed(1) ?? '-'}</Txt>
            </Txt>
            <Txt variant="small" tone="muted">
              참석 <Txt variant="smallStrong">{host.stats.attended}회</Txt>
            </Txt>
            <Txt variant="small" tone="muted">
              모임 <Txt variant="smallStrong">{host.stats.hosted}회</Txt>
            </Txt>
            <Txt variant="small" tone="muted">
              노쇼 <Txt variant="smallStrong">{host.stats.noShows}회</Txt>
            </Txt>
          </Row>
        </Card>
      ) : null}

      <Section title="모임 소개">
        <Txt>{meetup.description}</Txt>
      </Section>

      <Section title={`참여 중 ${participants.length}명`}>
        <Row style={{ gap: 0 }}>
          {participants.slice(0, 8).map((p, i) => (
            <View key={p.id} style={{ borderWidth: 2, borderColor: c.bg, borderRadius: 20, marginLeft: i === 0 ? 0 : -8 }}>
              <Avatar name={p.name} size={34} />
            </View>
          ))}
        </Row>
        <Txt variant="small" tone="muted">
          {composition}
        </Txt>
      </Section>

      <Section title="모임 규칙">
        <View style={{ gap: space.sm }}>
          {[
            '공개된 장소에서 모여 시작해요.',
            '사람을 알아볼 수 있게 찍었다면 먼저 동의를 받아요.',
            '못 오게 되면 시작 24시간 전까지 취소해 주세요. 노쇼는 기록돼요.',
            '문제가 생기면 모임 채팅의 긴급 신고를 눌러 주세요.',
          ].map((rule) => (
            <Row key={rule} style={{ alignItems: 'flex-start' }}>
              <Ionicons name="checkmark-circle-outline" size={18} color={c.accent} style={{ marginTop: 2 }} />
              <Txt variant="small" style={{ flex: 1 }}>
                {rule}
              </Txt>
            </Row>
          ))}
        </View>
      </Section>
    </Screen>
  );
}
