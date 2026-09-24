import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  Banner,
  Button,
  Chip,
  Field,
  Input,
  Row,
  Screen,
  Stepper,
  Toggle,
  Txt,
  Wrap,
} from '../components/ui';
import { useMe, useStore } from '../data/store';
import { formatShortDate } from '../domain/format';
import { activityTypes, ageBands, difficultyLabel, districts, genres as genreOptions, kindLabel } from '../domain/labels';
import {
  canHostMeetup,
  CAPACITY_MAX,
  CAPACITY_MIN,
  type DraftErrors,
  type MeetupDraft,
  validateMeetupDraft,
} from '../domain/meetupRules';
import type { ActivityType, AgeBand, Difficulty, Genre, MeetupKind } from '../domain/types';
import type { RootScreenProps } from '../navigation/types';
import { space } from '../theme';

const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export default function CreateMeetupScreen({ navigation }: RootScreenProps<'CreateMeetup'>) {
  const me = useMe();
  const { actions } = useStore();
  const eligibility = canHostMeetup(me);

  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i + 1));

  const [kind, setKind] = useState<MeetupKind>('flash');
  const [title, setTitle] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [district, setDistrict] = useState(me.district);
  const [dayIndex, setDayIndex] = useState(1);
  const [startMin, setStartMin] = useState(14 * 60);
  const [endMin, setEndMin] = useState(16 * 60);
  const [capacity, setCapacity] = useState(8);
  const [difficulty, setDifficulty] = useState<Difficulty>('welcome');
  const [feeType, setFeeType] = useState<'free' | 'cost'>('free');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeNote, setFeeNote] = useState('');
  const [picked, setPicked] = useState<Genre[]>(me.genres);
  const [targetTypes, setTargetTypes] = useState<ActivityType[]>([]);
  const [targetAges, setTargetAges] = useState<AgeBand[]>([]);
  const [approval, setApproval] = useState(true);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<DraftErrors>({});
  const [sending, setSending] = useState(false);

  const at = (min: number) => {
    const d = days[dayIndex];
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(min / 60), min % 60);
  };

  const draft = (): MeetupDraft => ({
    kind,
    title,
    placeName,
    district,
    startsAt: at(startMin),
    endsAt: at(endMin),
    capacity,
    difficulty,
    fee: feeType === 'free' ? { type: 'free' } : { type: 'cost', amount: Number(feeAmount.replace(/[^0-9]/g, '')), note: feeNote },
    genres: picked,
    targetTypes,
    targetAges,
    approval,
    description,
  });

  const submit = async () => {
    const d = draft();
    const found = validateMeetupDraft(d, new Date());
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSending(true);
    const id = await actions.createMeetup(d);
    setSending(false);
    if (id) navigation.replace('MeetupDetail', { id });
  };

  const errorCount = Object.keys(errors).length;

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          {errorCount > 0 ? (
            <Txt variant="caption" tone="danger" style={{ textAlign: 'center' }}>
              고칠 곳이 {errorCount}군데 있어요. 빨간 안내를 확인해 주세요.
            </Txt>
          ) : null}
          <Txt variant="caption" tone="muted" style={{ textAlign: 'center' }}>
            모임을 열면 커뮤니티 가이드라인과 안전 규칙(초상권 동의, 노쇼 기준)에 동의한 것으로 봐요.
          </Txt>
          <Button label="모임 열기" onPress={submit} disabled={!eligibility.ok} loading={sending} />
        </View>
      }
    >
      {!eligibility.ok ? (
        <Banner tone="warn" icon="lock-closed-outline">
          {eligibility.reason}
        </Banner>
      ) : null}

      <Wrap>
        {(Object.keys(kindLabel) as MeetupKind[]).map((k) => (
          <Chip key={k} label={kindLabel[k]} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </Wrap>

      <Field label="제목" error={errors.title}>
        <Input value={title} onChangeText={setTitle} placeholder="예: 성수동 골목 야경 스냅" maxLength={40} invalid={!!errors.title} />
      </Field>

      <Field label="모이는 장소" hint="역 출구·공원 입구처럼 공개된 곳" error={errors.place}>
        <Input value={placeName} onChangeText={setPlaceName} placeholder="예: 성수역 2번 출구 앞" invalid={!!errors.place} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {districts.map((d) => (
            <Chip key={d} label={d} selected={district === d} onPress={() => setDistrict(d)} />
          ))}
        </ScrollView>
      </Field>

      <Field label="날짜">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {days.map((d, i) => (
            <Chip key={d.toISOString()} label={formatShortDate(d)} selected={dayIndex === i} onPress={() => setDayIndex(i)} />
          ))}
        </ScrollView>
      </Field>

      <Field label="시간" hint="끝나는 시간도 꼭 정해요" error={errors.time}>
        <View style={{ gap: space.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="small" tone="muted">
              시작
            </Txt>
            <Stepper
              value={startMin}
              label={hhmm(startMin)}
              min={6 * 60}
              max={23 * 60}
              step={30}
              onChange={(v) => {
                setStartMin(v);
                if (endMin <= v) setEndMin(Math.min(v + 120, 24 * 60 - 30));
              }}
            />
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="small" tone="muted">
              끝
            </Txt>
            <Stepper value={endMin} label={hhmm(endMin)} min={6 * 60 + 30} max={24 * 60 - 30} step={30} onChange={setEndMin} />
          </Row>
        </View>
      </Field>

      <Field label="최대 인원" hint="모임장 포함" error={errors.capacity}>
        <Stepper value={capacity} label={`${capacity}명`} min={CAPACITY_MIN} max={CAPACITY_MAX} onChange={setCapacity} />
      </Field>

      <Field label="난이도">
        <Wrap>
          {(Object.keys(difficultyLabel) as Difficulty[]).map((d) => (
            <Chip key={d} label={difficultyLabel[d]} selected={difficulty === d} onPress={() => setDifficulty(d)} />
          ))}
        </Wrap>
      </Field>

      <Field label="참가비" error={errors.fee}>
        <Wrap>
          <Chip label="무료" selected={feeType === 'free'} onPress={() => setFeeType('free')} />
          <Chip label="실비" selected={feeType === 'cost'} onPress={() => setFeeType('cost')} />
        </Wrap>
        {feeType === 'cost' ? (
          <View style={{ gap: space.sm }}>
            <Input
              value={feeAmount}
              onChangeText={setFeeAmount}
              placeholder="금액 (원)"
              keyboardType="number-pad"
              invalid={!!errors.fee}
            />
            <Input value={feeNote} onChangeText={setFeeNote} placeholder="어디에 쓰나요? 예: 장소 대여비" invalid={!!errors.fee} />
            <Txt variant="caption" tone="muted">
              베타 기간에는 앱에서 결제하지 않아요. 실비는 모임장이 직접 받고, 용도를 모임 소개에 보여 줘요.
            </Txt>
          </View>
        ) : null}
      </Field>

      <Field label="장르">
        <Wrap>
          {genreOptions.map((g) => (
            <Chip key={g.value} label={g.label} selected={picked.includes(g.value)} onPress={() => setPicked((p) => toggleIn(p, g.value))} />
          ))}
        </Wrap>
      </Field>

      <Field label="대상 유형" hint="안 고르면 누구나">
        <Wrap>
          {activityTypes.map((t) => (
            <Chip
              key={t.value}
              label={t.label}
              selected={targetTypes.includes(t.value)}
              onPress={() => setTargetTypes((p) => toggleIn(p, t.value))}
            />
          ))}
        </Wrap>
      </Field>

      <Field label="대상 연령대" hint="안 고르면 전체">
        <Wrap>
          {ageBands.map((a) => (
            <Chip key={a.value} label={a.label} selected={targetAges.includes(a.value)} onPress={() => setTargetAges((p) => toggleIn(p, a.value))} />
          ))}
        </Wrap>
      </Field>

      <Toggle value={approval} onChange={setApproval} label="모임장 승인 후 참여" hint="끄면 신청 즉시 참여가 확정돼요" />

      <Field label="소개" error={errors.description}>
        <Input
          value={description}
          onChangeText={setDescription}
          placeholder="무엇을 찍는지, 준비물, 끝나고 하는 일을 적어 주세요."
          multiline
          invalid={!!errors.description}
        />
      </Field>

      <Banner tone="info" icon="shield-checkmark-outline">
        개인 스튜디오·숙소·차량 이동이 있는 모임과 모델을 섭외하는 인물 촬영회는 열 수 없어요.
      </Banner>
    </Screen>
  );
}
