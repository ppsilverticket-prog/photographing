import { addMannerScore, meetupsAwaitingReview, reviewTargets, reviewWindowOpen, wasPresent } from '../review';
import type { Meetup, Participation } from '../types';

const meetup: Meetup = {
  id: 'm1',
  kind: 'flash',
  title: '성수동 야경',
  genres: ['night'],
  startsAt: '2026-09-26T09:00:00Z',
  endsAt: '2026-09-26T12:00:00Z',
  place: { name: '성수역 2번 출구', district: '성동구' },
  capacity: 6,
  difficulty: 'welcome',
  fee: { type: 'free' },
  targetTypes: [],
  targetAges: [],
  approval: false,
  hostId: 'host',
  participantIds: ['host', 'a', 'b', 'c'],
  description: '',
};

const part = (userId: string, attendance: Participation['attendance'], status: Participation['status'] = 'confirmed'): Participation => ({
  meetupId: 'm1',
  userId,
  role: 'member',
  status,
  attendance,
});

const parts = [part('a', 'attended'), part('b', 'attended'), part('c', 'no_show'), part('d', 'attended', 'canceled')];
const afterEnd = new Date('2026-09-27T00:00:00Z');

test('모임이 끝난 뒤 7일 동안만 평가할 수 있다', () => {
  expect(reviewWindowOpen(meetup, new Date('2026-09-26T11:59:00Z'))).toBe(false);
  expect(reviewWindowOpen(meetup, new Date('2026-09-26T12:00:00Z'))).toBe(true);
  expect(reviewWindowOpen(meetup, new Date('2026-10-03T11:59:00Z'))).toBe(true);
  expect(reviewWindowOpen(meetup, new Date('2026-10-03T12:00:00Z'))).toBe(false);
});

test('모임장이나 참석 체크된 확정 참여자만 그 자리에 있었던 사람이다', () => {
  expect(wasPresent(meetup, 'host', [])).toBe(true);
  expect(wasPresent(meetup, 'a', parts)).toBe(true);
  expect(wasPresent(meetup, 'c', parts)).toBe(false);
  expect(wasPresent(meetup, 'd', parts)).toBe(false);
  expect(wasPresent(meetup, 'x', parts)).toBe(false);
});

test('평가 대상: 나를 빼고 그 자리에 있었던 사람 (노쇼는 제외)', () => {
  expect(reviewTargets(meetup, 'a', parts, afterEnd).sort()).toEqual(['b', 'host']);
  expect(reviewTargets(meetup, 'host', parts, afterEnd).sort()).toEqual(['a', 'b']);
  // 노쇼한 사람은 평가할 수 없다
  expect(reviewTargets(meetup, 'c', parts, afterEnd)).toEqual([]);
  // 기간이 지나면 아무도
  expect(reviewTargets(meetup, 'a', parts, new Date('2026-10-10T00:00:00Z'))).toEqual([]);
});

test('평가를 기다리는 모임: 아직 평가하지 않은 사람이 남아 있으면', () => {
  expect(meetupsAwaitingReview([meetup], 'a', parts, [], afterEnd)).toHaveLength(1);
  const done = [
    { meetupId: 'm1', revieweeId: 'host', score: 5 },
    { meetupId: 'm1', revieweeId: 'b', score: 4 },
  ];
  expect(meetupsAwaitingReview([meetup], 'a', parts, done, afterEnd)).toHaveLength(0);
});

test('신뢰도 평균은 소수 둘째 자리까지', () => {
  const base = { attended: 1, noShows: 0, lateCancels: 0, hosted: 0, manner: null, mannerCount: 0 };
  const one = addMannerScore(base, 5);
  expect(one).toMatchObject({ manner: 5, mannerCount: 1 });
  expect(addMannerScore(addMannerScore(one, 4), 4)).toMatchObject({ manner: 4.33, mannerCount: 3 });
});
