import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner, Button, Checkbox, Chip, Field, Input, Row, Screen, Txt, Wrap } from '../components/ui';
import { useStore } from '../data/store';
import { activityTypes, ageBands, districts, genres as genreOptions } from '../domain/labels';
import type { ActivityType, AgeBand, Genre } from '../domain/types';
import type { RootScreenProps } from '../navigation/types';
import { radius, space, usePalette } from '../theme';

const STEPS = 3;

export default function OnboardingScreen({ navigation }: RootScreenProps<'Onboarding'>) {
  const { actions, mode, state } = useStore();
  const server = mode === 'server';
  const insets = useSafeAreaInsets();
  const c = usePalette();

  const [stepChoice, setStep] = useState(1);
  // 서버 모드에서 로그인은 했지만 프로필이 없으면 2단계부터
  const step = server && state.authUserId && stepChoice === 1 ? 2 : stepChoice;
  const [name, setName] = useState('');
  const [type, setType] = useState<ActivityType | null>(null);
  const [age, setAge] = useState<AgeBand | null>(null);
  const [picked, setPicked] = useState<Genre[]>([]);
  const [district, setDistrict] = useState('성동구');
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  // 서버 모드는 연령대를 본인인증 결과로 정하므로 묻지 않는다
  const profileReady = name.trim().length >= 2 && type !== null && (server || age !== null);

  const progress = (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`${STEPS}단계 중 ${step}단계`}>
      {Array.from({ length: STEPS }, (_, i) => (
        <View key={i} style={[styles.bar, { backgroundColor: i < step ? c.accent : c.line }]} />
      ))}
    </View>
  );

  if (step === 1 && server) {
    return <SignIn progress={progress} />;
  }

  if (step === 1) {
    return (
      <Screen contentStyle={{ paddingTop: insets.top + space.xxl, flexGrow: 1 }}>
        {progress}
        <View style={{ gap: space.md }}>
          <Txt variant="title" style={{ fontSize: 28, lineHeight: 36 }}>
            이번 주말,{'\n'}같이 찍으러 갈 사람
          </Txt>
          <Txt tone="muted">
            출사 모임을 찾고, 직접 열고, 찍은 사진에 구체적인 피드백을 주고받아요.
          </Txt>
        </View>
        <View style={{ gap: space.sm }}>
          <Button label="카카오로 시작하기" icon="chatbubble" onPress={() => setStep(2)} />
          <Button label="Apple로 계속하기" icon="logo-apple" variant="secondary" onPress={() => setStep(2)} />
        </View>
        <Banner tone="info" icon="shield-checkmark-outline">
          처음 보는 사람과 만나는 서비스라 휴대폰 본인인증을 거친 만 19세 이상만 가입할 수 있어요. 프로토타입에서는
          로그인과 본인인증을 건너뛰어요.
        </Banner>
      </Screen>
    );
  }

  if (step === 2) {
    return (
      <Screen
        contentStyle={{ paddingTop: insets.top + space.lg }}
        footer={
          <Button
            label="다음"
            disabled={!profileReady}
            onPress={() => setStep(3)}
            accessibilityHint={server ? '이름과 활동 유형을 고르면 다음으로 넘어가요' : '이름, 활동 유형, 연령대를 고르면 다음으로 넘어가요'}
          />
        }
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={server ? '다른 계정으로 로그인' : '뒤로'}
            onPress={() => (server ? actions.signOut() : setStep(1))}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={24} color={c.ink} />
          </Pressable>
          <Txt variant="small" tone="muted">
            2 / 3
          </Txt>
        </Row>
        {progress}
        <View style={{ gap: 6 }}>
          <Txt variant="title">어떤 사진가에 가까우세요?</Txt>
          <Txt variant="small" tone="muted">
            설정에 맞춰 모임과 정보를 추천해요. 나중에 바꿀 수 있어요.
          </Txt>
        </View>

        <Field label="활동 이름" hint="다른 사람에게 보이는 이름">
          <Input value={name} onChangeText={setName} placeholder="예: 김민수" maxLength={12} autoComplete="name" />
        </Field>

        <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
          {activityTypes.map((t) => {
            const on = type === t.value;
            return (
              <Pressable
                key={t.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setType(t.value)}
                style={[
                  styles.option,
                  { borderColor: on ? c.accent : c.line, borderWidth: on ? 2 : 1, backgroundColor: on ? c.accentSoft : c.bg },
                ]}
              >
                <View style={[styles.radio, { borderColor: on ? c.accent : c.line, borderWidth: on ? 7 : 2 }]} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{t.label}</Txt>
                  <Txt variant="caption" tone="muted">
                    {t.hint}
                  </Txt>
                </View>
              </Pressable>
            );
          })}
        </View>

        {server ? (
          <Banner tone="info" icon="shield-checkmark-outline">
            연령대는 휴대폰 본인인증 결과로 자동으로 정해져요. 모임의 대상 연령대를 속일 수 없게 하려는 거예요.
          </Banner>
        ) : (
          <Field label="연령대">
            <Wrap>
              {ageBands.map((a) => (
                <Chip key={a.value} label={a.label} selected={age === a.value} onPress={() => setAge(a.value)} />
              ))}
            </Wrap>
          </Field>
        )}

        <Field label="관심 장르" hint="여러 개 골라도 돼요">
          <Wrap>
            {genreOptions.map((g) => (
              <Chip
                key={g.value}
                label={g.label}
                selected={picked.includes(g.value)}
                onPress={() =>
                  setPicked((prev) => (prev.includes(g.value) ? prev.filter((x) => x !== g.value) : [...prev, g.value]))
                }
              />
            ))}
          </Wrap>
        </Field>

        <Field label="주 활동 지역" hint="지금은 서울만 운영해요">
          <Wrap>
            {districts.map((d) => (
              <Chip key={d} label={d} selected={district === d} onPress={() => setDistrict(d)} />
            ))}
          </Wrap>
        </Field>
      </Screen>
    );
  }

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + space.lg }}
      footer={
        <Button
          label="포토그래핑 시작하기"
          disabled={!agreed || !profileReady}
          loading={saving}
          onPress={async () => {
            if (!type) return;
            setSaving(true);
            const ok = await actions.onboard({ name: name.trim(), type, age: server ? null : age, genres: picked, district });
            // 성공하면 화면이 홈으로 바뀐다. 실패하면 안내가 뜨고 이 화면에 남는다
            if (!ok) setSaving(false);
          }}
        />
      }
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => setStep(2)} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={c.ink} />
        </Pressable>
        <Txt variant="small" tone="muted">
          3 / 3
        </Txt>
      </Row>
      {progress}
      <View style={{ gap: 6 }}>
        <Txt variant="title">함께 지킬 약속</Txt>
        <Txt variant="small" tone="muted">
          모두가 안심하고 다시 나올 수 있도록 이것만은 꼭 지켜 주세요.
        </Txt>
      </View>
      <View style={{ gap: space.md }}>
        {[
          ['camera-outline', '사람을 알아볼 수 있게 찍었다면 먼저 물어봐요. 몰래 찍기는 바로 영구 정지예요.'],
          ['calendar-outline', '못 가게 되면 시작 24시간 전까지 취소해요. 연락 없는 불참은 기록이 남아요.'],
          ['hand-left-outline', '모임은 사진을 찍으러 나온 자리예요. 연락처나 따로 만남을 강요하지 않아요.'],
          ['chatbubble-ellipses-outline', '피드백은 사진에 대해서만 해요. 사람을 깎아내리지 않아요.'],
        ].map(([icon, text]) => (
          <Row key={text} style={{ alignItems: 'flex-start', gap: space.md }}>
            <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={c.accent} style={{ marginTop: 2 }} />
            <Txt style={{ flex: 1 }}>{text}</Txt>
          </Row>
        ))}
      </View>
      <Button
        label="커뮤니티 가이드라인 전체 보기"
        variant="ghost"
        icon="document-text-outline"
        onPress={() => navigation.navigate('Guidelines')}
      />
      <Checkbox value={agreed} onChange={setAgreed} label="이용약관과 커뮤니티 가이드라인에 동의해요 (필수)" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { flex: 1, height: 4, borderRadius: 2 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  radio: { width: 22, height: 22, borderRadius: 11 },
});

/** 서버 모드 1단계: 이메일 로그인·가입. 카카오·Apple 로그인은 개발자 계정 준비 후 붙인다 */
function SignIn({ progress }: { progress: ReactNode }) {
  const { actions } = useStore();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'in' | 'up' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'danger' | 'info'; text: string } | null>(null);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= 6;

  const submit = async (kind: 'in' | 'up') => {
    setBusy(kind);
    setNotice(null);
    const result = kind === 'in' ? await actions.signIn(email, password) : await actions.signUp(email, password);
    setBusy(null);
    if (result.error) setNotice({ tone: 'danger', text: result.error });
    else if (result.info) setNotice({ tone: 'info', text: result.info });
  };

  return (
    <Screen contentStyle={{ paddingTop: insets.top + space.xxl, flexGrow: 1 }}>
      {progress}
      <View style={{ gap: space.md }}>
        <Txt variant="title" style={{ fontSize: 28, lineHeight: 36 }}>
          이번 주말,{'\n'}같이 찍으러 갈 사람
        </Txt>
        <Txt tone="muted">출사 모임을 찾고, 직접 열고, 찍은 사진에 구체적인 피드백을 주고받아요.</Txt>
      </View>
      <View style={{ gap: space.md }}>
        <Field label="이메일">
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </Field>
        <Field label="비밀번호" hint="6자 이상">
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
          />
        </Field>
        {notice ? (
          <Banner tone={notice.tone} icon={notice.tone === 'danger' ? 'alert-circle-outline' : 'mail-outline'}>
            {notice.text}
          </Banner>
        ) : null}
        <Button label="로그인" onPress={() => submit('in')} disabled={!valid || busy !== null} loading={busy === 'in'} />
        <Button
          label="처음이에요, 가입하기"
          variant="secondary"
          onPress={() => submit('up')}
          disabled={!valid || busy !== null}
          loading={busy === 'up'}
        />
      </View>
      <Banner tone="info" icon="shield-checkmark-outline">
        개발 중에는 이메일로 로그인해요. 카카오·Apple 로그인과 휴대폰 본인인증은 출시 전에 붙여요.
      </Banner>
    </Screen>
  );
}
