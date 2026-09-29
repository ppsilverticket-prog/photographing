// 모임 후기(매너 평가). DB의 can_review 함수와 같은 기준이다 (supabase/migrations/20260924100100_functions.sql).
// 모임이 끝나고 7일 안에, 그 자리에 있었던 사람끼리(모임장 또는 참석 체크된 참여자) 서로 한 번씩 평가한다.
import type { Meetup, MemberStats, Participation } from './types';

export const REVIEW_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

/** 내가 남긴 평가. 한 번 남기면 바꿀 수 없다 */
export interface ReviewRecord {
  meetupId: string;
  revieweeId: string;
  score: number;
}

export const mannerLabels: Record<number, string> = {
  1: '아쉬웠어요',
  2: '조금 아쉬웠어요',
  3: '보통이에요',
  4: '좋았어요',
  5: '최고예요',
};

export function reviewWindowOpen(meetup: Meetup, now: Date): boolean {
  const end = new Date(meetup.endsAt).getTime();
  return end <= now.getTime() && now.getTime() < end + REVIEW_DAYS * DAY;
}

/** 모임 자리에 있었는지: 모임장이거나, 확정된 참여자 중 참석으로 체크된 사람 */
export function wasPresent(meetup: Meetup, userId: string, participations: Participation[]): boolean {
  if (userId === meetup.hostId) return true;
  const p = participations.find((x) => x.meetupId === meetup.id && x.userId === userId);
  return !!p && p.status === 'confirmed' && p.attendance === 'attended';
}

/** 내가 평가할 수 있는 사람. 이미 평가한 사람도 포함한다 (화면에서 "남김"으로 보여 준다) */
export function reviewTargets(meetup: Meetup, reviewerId: string, participations: Participation[], now: Date): string[] {
  if (!reviewWindowOpen(meetup, now) || !wasPresent(meetup, reviewerId, participations)) return [];
  const ids = new Set([meetup.hostId, ...meetup.participantIds]);
  return [...ids].filter((id) => id !== reviewerId && wasPresent(meetup, id, participations));
}

/** 아직 평가하지 않은 사람이 남은 모임 */
export function meetupsAwaitingReview(
  meetups: Meetup[],
  reviewerId: string,
  participations: Participation[],
  reviews: ReviewRecord[],
  now: Date,
): Meetup[] {
  return meetups.filter((m) =>
    reviewTargets(m, reviewerId, participations, now).some(
      (id) => !reviews.some((r) => r.meetupId === m.id && r.revieweeId === id),
    ),
  );
}

/** 새 평가를 더한 신뢰도. DB의 manner_avg처럼 소수 둘째 자리까지 */
export function addMannerScore(stats: MemberStats, score: number): MemberStats {
  const count = stats.mannerCount + 1;
  const sum = (stats.manner ?? 0) * stats.mannerCount + score;
  return { ...stats, manner: Math.round((sum / count) * 100) / 100, mannerCount: count };
}
