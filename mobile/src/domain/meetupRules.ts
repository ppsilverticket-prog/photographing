// 모임 개설 조건과 입력 검사. 운영정책 초안 docs/07-operations-policy.md 4-1절.
import { formatWon } from './format';
import type { ActivityType, AgeBand, Difficulty, Fee, Genre, Meetup, MeetupKind, Member } from './types';

const HOUR = 60 * 60 * 1000;

export type HostEligibility = { ok: true } | { ok: false; reason: string };

export function canHostMeetup(member: Member): HostEligibility {
  if (!member.verified) {
    return { ok: false, reason: '본인인증을 마치면 모임을 열 수 있어요.' };
  }
  if (!member.foundingHost && member.stats.attended < 1) {
    return {
      ok: false,
      reason: '다른 모임에 한 번 이상 참석하면 모임을 열 수 있어요. 처음 온 사람이 모임을 미끼로 쓰는 일을 막기 위한 규칙이에요.',
    };
  }
  return { ok: true };
}

export interface MeetupDraft {
  kind: MeetupKind;
  title: string;
  placeName: string;
  district: string;
  startsAt: Date | null;
  endsAt: Date | null;
  capacity: number;
  difficulty: Difficulty;
  fee: Fee;
  genres: Genre[];
  targetTypes: ActivityType[];
  targetAges: AgeBand[];
  approval: boolean;
  description: string;
}

export type DraftField = 'title' | 'place' | 'time' | 'capacity' | 'fee' | 'description';
export type DraftErrors = Partial<Record<DraftField, string>>;

export const CAPACITY_MIN = 2;
export const CAPACITY_MAX = 30;
export const MAX_DURATION_HOURS = 12;
export const MAX_COST_FEE = 50000;

// 모델을 섭외하는 인물 촬영회는 MVP에서 열 수 없다 (4-1절)
const MODEL_SHOOT_PATTERNS = [/모델\s*섭외/, /촬영회/, /모델\s*출사/, /피팅\s*모델/];

export function looksLikeModelShoot(text: string): boolean {
  return MODEL_SHOOT_PATTERNS.some((p) => p.test(text));
}

export function validateMeetupDraft(d: MeetupDraft, now: Date): DraftErrors {
  const errors: DraftErrors = {};
  const title = d.title.trim();

  if (title.length < 4) errors.title = '제목을 4자 이상 적어 주세요.';
  else if (title.length > 40) errors.title = '제목은 40자까지 쓸 수 있어요.';

  if (!d.placeName.trim()) errors.place = '모이는 장소를 적어 주세요. 역 출구나 공원 입구처럼 누구나 찾을 수 있는 곳이 좋아요.';
  else if (!d.district) errors.place = '지역(구)을 골라 주세요.';

  if (!d.startsAt || !d.endsAt) {
    errors.time = '시작 시간과 끝나는 시간을 모두 정해 주세요.';
  } else if (d.startsAt.getTime() < now.getTime() + HOUR) {
    errors.time = '모임은 지금부터 1시간 뒤 이후로 열 수 있어요.';
  } else if (d.endsAt <= d.startsAt) {
    errors.time = '끝나는 시간이 시작 시간보다 뒤여야 해요.';
  } else if (d.endsAt.getTime() - d.startsAt.getTime() > MAX_DURATION_HOURS * HOUR) {
    errors.time = `모임은 ${MAX_DURATION_HOURS}시간까지 열 수 있어요.`;
  }

  if (!Number.isInteger(d.capacity) || d.capacity < CAPACITY_MIN || d.capacity > CAPACITY_MAX) {
    errors.capacity = `인원은 모임장을 포함해 ${CAPACITY_MIN}~${CAPACITY_MAX}명으로 정해 주세요.`;
  }

  if (d.fee.type === 'cost') {
    if (!Number.isInteger(d.fee.amount) || d.fee.amount < 1 || d.fee.amount > MAX_COST_FEE) {
      errors.fee = `실비는 1원부터 ${formatWon(MAX_COST_FEE)}까지 적을 수 있어요.`;
    } else if (!d.fee.note.trim()) {
      errors.fee = '실비를 어디에 쓰는지 적어 주세요. 예: 장소 대여비';
    }
  }

  if (looksLikeModelShoot(`${title} ${d.description}`)) {
    errors.description = '모델을 섭외하는 인물 촬영회는 열 수 없어요. 참여자끼리 서로 찍어 주는 인물 스냅은 괜찮아요.';
  } else if (d.description.trim().length < 10) {
    errors.description = '어떤 모임인지 10자 이상 소개해 주세요.';
  }

  return errors;
}

export function buildMeetup(d: MeetupDraft, id: string, hostId: string): Meetup {
  if (!d.startsAt || !d.endsAt) throw new Error('검사를 통과한 초안만 모임으로 만들 수 있어요.');
  return {
    id,
    kind: d.kind,
    title: d.title.trim(),
    genres: d.genres,
    startsAt: d.startsAt.toISOString(),
    endsAt: d.endsAt.toISOString(),
    place: { name: d.placeName.trim(), district: d.district },
    capacity: d.capacity,
    difficulty: d.difficulty,
    fee: d.fee.type === 'cost' ? { ...d.fee, note: d.fee.note.trim() } : d.fee,
    targetTypes: d.targetTypes,
    targetAges: d.targetAges,
    approval: d.approval,
    hostId,
    participantIds: [hostId],
    description: d.description.trim(),
  };
}

export function seatsLeft(m: Meetup): number {
  return Math.max(0, m.capacity - m.participantIds.length);
}

/** 대상 유형·연령대 제한에 맞는가. 비어 있으면 누구나 */
export function isEligible(m: Meetup, member: Pick<Member, 'type' | 'age'>): boolean {
  const typeOk = m.targetTypes.length === 0 || m.targetTypes.includes(member.type);
  const ageOk = m.targetAges.length === 0 || m.targetAges.includes(member.age);
  return typeOk && ageOk;
}
