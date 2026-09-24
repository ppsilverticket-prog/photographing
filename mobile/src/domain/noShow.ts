// 노쇼와 취소 기준. 운영정책 초안 docs/07-operations-policy.md 4-2절의 제안값을 따른다.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const LATE_CANCEL_HOURS = 24;
export const NO_SHOW_WINDOW_DAYS = 90;

export type CancellationKind = 'normal' | 'late';

/** 모임 시작 24시간 전까지는 정상 취소, 그 뒤는 늦은 취소 */
export function classifyCancellation(startsAt: Date, cancelledAt: Date): CancellationKind {
  return startsAt.getTime() - cancelledAt.getTime() >= LATE_CANCEL_HOURS * HOUR ? 'normal' : 'late';
}

export type Restriction =
  | { kind: 'none' }
  | { kind: 'warning'; count: number }
  | { kind: 'blocked'; count: number; until: Date }
  | { kind: 'approvalOnly'; count: number };

/**
 * 최근 90일 노쇼 횟수에 따른 모임 신청 제한.
 * 1회: 알림 / 2회: 마지막 노쇼부터 14일 제한 / 3회 이상: 30일 제한, 이후 모임장 승인 모임만 참여
 */
export function participationRestriction(noShowDates: Date[], now: Date): Restriction {
  const windowStart = now.getTime() - NO_SHOW_WINDOW_DAYS * DAY;
  const recent = noShowDates
    .map((d) => d.getTime())
    .filter((t) => t >= windowStart && t <= now.getTime())
    .sort((a, b) => b - a);
  const count = recent.length;
  if (count === 0) return { kind: 'none' };
  if (count === 1) return { kind: 'warning', count };

  const days = count === 2 ? 14 : 30;
  const until = new Date(recent[0] + days * DAY);
  if (now < until) return { kind: 'blocked', count, until };
  return count === 2 ? { kind: 'warning', count } : { kind: 'approvalOnly', count };
}

/** 이 제한 상태로 해당 모임에 신청할 수 있는가 */
export function canRequestToJoin(restriction: Restriction, meetupRequiresApproval: boolean): boolean {
  if (restriction.kind === 'blocked') return false;
  if (restriction.kind === 'approvalOnly') return meetupRequiresApproval;
  return true;
}
