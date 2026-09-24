import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Banner, Button, Card, Checkbox, Field, Input, Screen, Txt } from '../components/ui';
import { ME, useStore } from '../data/store';
import { reportReasons } from '../domain/labels';
import type { ReportReason } from '../domain/types';
import type { RootScreenProps } from '../navigation/types';
import { radius, space, usePalette } from '../theme';

export default function ReportScreen({ route, navigation }: RootScreenProps<'Report'>) {
  const { kind, id } = route.params;
  const { state, actions } = useStore();
  const c = usePalette();
  const [reason, setReason] = useState<ReportReason | null>(route.params.reason ?? null);
  const [detail, setDetail] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [done, setDone] = useState(false);

  const meetup = kind === 'meetup' ? state.meetups.find((m) => m.id === id) : undefined;
  const post = kind === 'post' ? state.posts.find((p) => p.id === id) : undefined;
  const personId = kind === 'member' ? id : (meetup?.hostId ?? post?.authorId);
  const person = personId && personId !== ME ? state.members[personId] : undefined;
  const targetText = meetup ? `모임: ${meetup.title}` : post ? `글: ${post.title}` : person ? `사용자: ${person.name}` : '';

  if (done) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: space.md, paddingTop: space.xxl }}>
          <Ionicons name="checkmark-circle" size={48} color={c.accent} />
          <Txt variant="title">신고를 접수했어요</Txt>
          <Txt tone="muted" style={{ textAlign: 'center' }}>
            {reason === 'emergency' || reason === 'illegal_filming'
              ? '해당 내용을 먼저 가리고 바로 확인해요. 결과는 알림으로 알려드려요.'
              : '24시간 안에 확인하고 결과를 알림으로 알려드려요.'}
          </Txt>
        </View>
        {reason === 'emergency' ? (
          <Card style={{ alignItems: 'center' }}>
            <Txt variant="bodyStrong" tone="danger">
              지금 위험하다면 경찰에 먼저 연락하세요
            </Txt>
            <Txt variant="title" tone="danger" selectable style={{ fontSize: 34, lineHeight: 40 }}>
              112
            </Txt>
          </Card>
        ) : null}
        <Banner tone="warn" icon="construct-outline">
          프로토타입이라 신고는 이 기기에만 저장되고 운영팀에 전달되지 않아요.
        </Banner>
        <Button label="닫기" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const submit = () => {
    if (!reason) return;
    actions.report(kind, id, reason, detail.trim());
    if (alsoBlock && person) actions.block(person.id);
    setDone(true);
  };

  return (
    <Screen footer={<Button label="신고하기" variant="danger" onPress={submit} disabled={!reason} />}>
      <Txt variant="small" tone="muted">
        {targetText}
      </Txt>

      <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
        <Txt variant="subheading">어떤 문제인가요?</Txt>
        {reportReasons.map((r) => {
          const on = reason === r.value;
          const urgent = r.value === 'emergency';
          return (
            <Pressable
              key={r.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setReason(r.value)}
              style={[
                styles.option,
                {
                  borderColor: on ? (urgent ? c.danger : c.accent) : c.line,
                  backgroundColor: on ? (urgent ? c.dangerSoft : c.accentSoft) : c.bg,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong" tone={urgent ? 'danger' : 'ink'}>
                  {r.label}
                </Txt>
                {r.hint ? (
                  <Txt variant="caption" tone="muted">
                    {r.hint}
                  </Txt>
                ) : null}
              </View>
              {on ? <Ionicons name="checkmark" size={20} color={urgent ? c.danger : c.accent} /> : null}
            </Pressable>
          );
        })}
      </View>

      {reason === 'emergency' ? (
        <Banner tone="danger" icon="call-outline">
          지금 위험하다면 이 신고보다 112에 먼저 연락하세요.
        </Banner>
      ) : null}

      <Field label="자세한 내용" hint="선택">
        <Input value={detail} onChangeText={setDetail} placeholder="언제, 어떤 일이 있었는지 적어 주세요." multiline />
      </Field>

      {person ? <Checkbox value={alsoBlock} onChange={setAlsoBlock} label={`${person.name} 님도 차단할게요`} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
});
