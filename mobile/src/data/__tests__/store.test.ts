import { buildMeetup } from '../../domain/meetupRules';
import { initialState, ME, reducer } from '../store';

const now = new Date(2026, 8, 24, 12, 0);

function signedIn() {
  return reducer(initialState(now), {
    type: 'onboard',
    profile: { name: '새사람', type: 'beginner', age: '20s', genres: ['snap'], district: '성동구' },
  });
}

describe('앱 상태', () => {
  it('온보딩을 마치면 본인인증된 새 회원이 된다', () => {
    const s = signedIn();
    expect(s.me?.id).toBe(ME);
    expect(s.me?.verified).toBe(true);
    expect(s.me?.stats.attended).toBe(0);
    expect(s.members[ME]).toBe(s.me);
  });

  it('승인제 모임은 대기, 바로 참여 모임은 즉시 확정', () => {
    let s = signedIn();
    s = reducer(s, { type: 'join', meetupId: 'm-seongsu' });
    expect(s.pending).toContain('m-seongsu');
    expect(s.meetups.find((m) => m.id === 'm-seongsu')?.participantIds).not.toContain(ME);

    s = reducer(s, { type: 'approvePending', meetupId: 'm-seongsu' });
    expect(s.pending).not.toContain('m-seongsu');
    expect(s.meetups.find((m) => m.id === 'm-seongsu')?.participantIds).toContain(ME);

    s = reducer(s, { type: 'join', meetupId: 'm-seoulforest' });
    expect(s.meetups.find((m) => m.id === 'm-seoulforest')?.participantIds).toContain(ME);
  });

  it('시작 24시간 이내 취소는 늦은 취소로 센다', () => {
    let s = signedIn();
    const start = new Date(now.getTime() + 5 * 3600000);
    const meetup = {
      ...buildMeetup(
        {
          kind: 'flash',
          title: '오늘 저녁 번개',
          placeName: '성수역',
          district: '성동구',
          startsAt: start,
          endsAt: new Date(start.getTime() + 2 * 3600000),
          capacity: 6,
          difficulty: 'welcome',
          fee: { type: 'free' },
          genres: [],
          targetTypes: [],
          targetAges: [],
          approval: false,
          description: '오늘 저녁에 가볍게 찍어요.',
        },
        'm-tonight',
        'minsu',
      ),
      participantIds: ['minsu', ME],
    };
    s = { ...s, meetups: [meetup, ...s.meetups] };

    s = reducer(s, { type: 'cancel', meetupId: 'm-tonight', at: now });
    expect(s.me?.stats.lateCancels).toBe(1);
    expect(s.meetups.find((m) => m.id === 'm-tonight')?.participantIds).toEqual(['minsu']);

    // 대기 중인 신청 취소는 기록하지 않는다
    s = reducer(s, { type: 'join', meetupId: 'm-seongsu' });
    s = reducer(s, { type: 'cancel', meetupId: 'm-seongsu', at: now });
    expect(s.pending).toEqual([]);
    expect(s.me?.stats.lateCancels).toBe(1);
  });

  it('모임을 만들면 개설 횟수가 늘고 목록 맨 위에 온다', () => {
    let s = signedIn();
    const meetup = { ...s.meetups[0], id: 'm-new', hostId: ME, participantIds: [ME] };
    s = reducer(s, { type: 'createMeetup', meetup });
    expect(s.meetups[0].id).toBe('m-new');
    expect(s.me?.stats.hosted).toBe(1);
  });

  it('노쇼 기록과 창립 모임장 전환 (프로토타입 도구)', () => {
    let s = signedIn();
    s = reducer(s, { type: 'proto', change: 'addNoShow' });
    s = reducer(s, { type: 'proto', change: 'addNoShow' });
    expect(s.me?.noShowDates).toHaveLength(2);
    expect(s.me?.stats.noShows).toBe(2);
    s = reducer(s, { type: 'proto', change: 'clearNoShows' });
    expect(s.me?.noShowDates).toHaveLength(0);
    s = reducer(s, { type: 'proto', change: 'foundingHost' });
    expect(s.me?.foundingHost).toBe(true);
  });

  it('계정을 지우면 처음 상태로 돌아간다', () => {
    let s = signedIn();
    s = reducer(s, { type: 'block', memberId: 'minsu' });
    s = reducer(s, { type: 'deleteAccount' });
    expect(s.me).toBeNull();
    expect(s.blocked).toEqual([]);
    expect(s.members[ME]).toBeUndefined();
  });
});
