import { useState } from 'react';
import { View } from 'react-native';

import {
  Avatar,
  Banner,
  Button,
  Card,
  Chip,
  Divider,
  Field,
  InlineConfirm,
  Row,
  Screen,
  Section,
  Txt,
  Wrap,
} from '../components/ui';
import { useMe, useStore } from '../data/store';
import { activityTypes, ageBands, districts } from '../domain/labels';
import type { RootScreenProps } from '../navigation/types';
import { space } from '../theme';

export default function SettingsScreen({ navigation }: RootScreenProps<'Settings'>) {
  const me = useMe();
  const { state, actions, mode } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const blocked = state.blocked.map((id) => state.members[id]).filter(Boolean);

  return (
    <Screen>
      <Section title="활동 정보">
        <Txt variant="small" tone="muted">
          홈 추천과 모임 대상 확인에 쓰여요.
        </Txt>
        <Field label="활동 유형">
          <Wrap>
            {activityTypes.map((t) => (
              <Chip key={t.value} label={t.label} selected={me.type === t.value} onPress={() => actions.updateProfile({ type: t.value })} />
            ))}
          </Wrap>
        </Field>
        {mode === 'server' ? (
          <Field label="연령대" hint="본인인증 결과로 정해져요">
            <Txt>{me.age ? ageBands.find((a) => a.value === me.age)?.label : '본인인증 전'}</Txt>
          </Field>
        ) : (
          <Field label="연령대">
            <Wrap>
              {ageBands.map((a) => (
                <Chip key={a.value} label={a.label} selected={me.age === a.value} onPress={() => actions.updateProfile({ age: a.value })} />
              ))}
            </Wrap>
          </Field>
        )}
        <Field label="주 활동 지역">
          <Wrap>
            {districts.map((d) => (
              <Chip key={d} label={d} selected={me.district === d} onPress={() => actions.updateProfile({ district: d })} />
            ))}
          </Wrap>
        </Field>
      </Section>

      <Section title={`차단한 사람 ${blocked.length}`}>
        {blocked.length === 0 ? (
          <Txt tone="muted">차단한 사람이 없어요. 차단하면 서로의 모임과 글이 보이지 않아요.</Txt>
        ) : (
          <Card style={{ gap: space.sm }}>
            {blocked.map((m, i) => (
              <View key={m.id} style={{ gap: space.sm }}>
                {i > 0 ? <Divider /> : null}
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row>
                    <Avatar name={m.name} size={28} />
                    <Txt variant="bodyStrong">{m.name}</Txt>
                  </Row>
                  <Button label="차단 해제" variant="secondary" onPress={() => actions.unblock(m.id)} style={{ minHeight: 36 }} />
                </Row>
              </View>
            ))}
          </Card>
        )}
      </Section>

      <Section title="안전">
        <Button
          label="커뮤니티 가이드라인"
          variant="secondary"
          icon="document-text-outline"
          onPress={() => navigation.navigate('Guidelines')}
        />
        <Txt variant="small" tone="muted">
          지금까지 보낸 신고 {state.reports.length}건. 신고는 24시간 안에 확인해요.
        </Txt>
      </Section>

      <Section title="계정">
        {mode === 'server' ? (
          <Button label="로그아웃" variant="secondary" icon="log-out-outline" onPress={actions.signOut} />
        ) : null}
        {confirmDelete ? (
          <InlineConfirm
            tone="danger"
            message="계정을 지우면 프로필, 참여 기록, 올린 글이 모두 사라지고 되돌릴 수 없어요. 재가입 제한을 위한 최소 정보만 운영정책에 따라 보관해요."
            confirmLabel="계정 삭제"
            onConfirm={actions.deleteAccount}
            onCancel={() => setConfirmDelete(false)}
          />
        ) : (
          <Button label="계정 삭제" variant="danger" icon="trash-outline" onPress={() => setConfirmDelete(true)} />
        )}
      </Section>

      {mode === 'local' ? (
        <Section title="프로토타입 도구">
          <Banner tone="warn" icon="construct-outline">
            시연과 인터뷰용 기능이에요. 실제 앱에는 없어요.
          </Banner>
          <Button
            label={me.foundingHost ? '창립 모임장 해제' : '창립 모임장으로 보기 (모임 열기 체험)'}
            variant="secondary"
            onPress={() => actions.proto('foundingHost')}
          />
          <Row>
            <Button label="노쇼 1회 추가" variant="secondary" onPress={() => actions.proto('addNoShow')} style={{ flex: 1 }} />
            <Button label="노쇼 기록 지우기" variant="secondary" onPress={() => actions.proto('clearNoShows')} style={{ flex: 1 }} />
          </Row>
        </Section>
      ) : null}
    </Screen>
  );
}
