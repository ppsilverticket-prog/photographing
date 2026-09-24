import { formatExifLine, formatShutter, hasGpsData, summarizeExif, uploadResize } from '../exif';
import { formatRange, formatShortDateTime, formatWon, isThisWeekend, relativeTime } from '../format';
import {
  buildMeetup,
  canHostMeetup,
  isEligible,
  looksLikeModelShoot,
  type MeetupDraft,
  validateMeetupDraft,
} from '../meetupRules';
import { canRequestToJoin, classifyCancellation, participationRestriction } from '../noShow';
import type { Member } from '../types';

const DAY = 24 * 60 * 60 * 1000;
// 2026-09-24 (목) 12:00, 기기 시간대 기준
const now = new Date(2026, 8, 24, 12, 0);

describe('노쇼 기준 (운영정책 4-2절)', () => {
  it('24시간 전까지는 정상 취소, 그 뒤는 늦은 취소', () => {
    const start = new Date(2026, 8, 26, 14, 0);
    expect(classifyCancellation(start, new Date(2026, 8, 25, 14, 0))).toBe('normal');
    expect(classifyCancellation(start, new Date(2026, 8, 25, 14, 1))).toBe('late');
  });

  it('90일 안의 노쇼 횟수로 제한한다', () => {
    const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);
    expect(participationRestriction([], now)).toEqual({ kind: 'none' });
    expect(participationRestriction([daysAgo(3)], now)).toEqual({ kind: 'warning', count: 1 });

    const two = participationRestriction([daysAgo(40), daysAgo(3)], now);
    expect(two.kind).toBe('blocked');
    if (two.kind === 'blocked') expect(two.until.getTime()).toBe(daysAgo(3).getTime() + 14 * DAY);

    // 14일이 지나면 제한은 풀리고 경고만 남는다
    expect(participationRestriction([daysAgo(40), daysAgo(20)], now)).toEqual({ kind: 'warning', count: 2 });

    // 3회 이상: 30일 제한, 이후 승인제 모임만
    expect(participationRestriction([daysAgo(60), daysAgo(40), daysAgo(10)], now).kind).toBe('blocked');
    expect(participationRestriction([daysAgo(80), daysAgo(70), daysAgo(35)], now)).toEqual({
      kind: 'approvalOnly',
      count: 3,
    });

    // 90일이 지난 노쇼는 세지 않는다
    expect(participationRestriction([daysAgo(91), daysAgo(120)], now)).toEqual({ kind: 'none' });
  });

  it('제한 상태에 따라 신청 가능 여부가 달라진다', () => {
    expect(canRequestToJoin({ kind: 'none' }, false)).toBe(true);
    expect(canRequestToJoin({ kind: 'blocked', count: 2, until: now }, true)).toBe(false);
    expect(canRequestToJoin({ kind: 'approvalOnly', count: 3 }, false)).toBe(false);
    expect(canRequestToJoin({ kind: 'approvalOnly', count: 3 }, true)).toBe(true);
  });
});

const member = (over: Partial<Member> = {}): Member => ({
  id: 'u1',
  name: '테스트',
  type: 'amateur',
  age: '30s',
  district: '성동구',
  genres: [],
  verified: true,
  stats: { attended: 1, noShows: 0, lateCancels: 0, hosted: 0, manner: null, mannerCount: 0 },
  noShowDates: [],
  ...over,
});

const draft = (over: Partial<MeetupDraft> = {}): MeetupDraft => ({
  kind: 'flash',
  title: '성수동 골목 야경 스냅',
  placeName: '성수역 2번 출구',
  district: '성동구',
  startsAt: new Date(2026, 8, 26, 18, 30),
  endsAt: new Date(2026, 8, 26, 21, 0),
  capacity: 8,
  difficulty: 'welcome',
  fee: { type: 'free' },
  genres: ['night', 'snap'],
  targetTypes: [],
  targetAges: [],
  approval: true,
  description: '골목 네온을 주제로 손각대 야경을 연습해요.',
  ...over,
});

describe('모임 개설 조건 (운영정책 4-1절)', () => {
  it('본인인증과 참석 1회 이상이 필요하고 창립 모임장은 예외', () => {
    expect(canHostMeetup(member()).ok).toBe(true);
    expect(canHostMeetup(member({ verified: false })).ok).toBe(false);
    const newbie = member({ stats: { attended: 0, noShows: 0, lateCancels: 0, hosted: 0, manner: null, mannerCount: 0 } });
    expect(canHostMeetup(newbie).ok).toBe(false);
    expect(canHostMeetup({ ...newbie, foundingHost: true }).ok).toBe(true);
  });

  it('올바른 초안은 오류가 없다', () => {
    expect(validateMeetupDraft(draft(), now)).toEqual({});
  });

  it('시간, 인원, 실비, 소개를 검사한다', () => {
    expect(validateMeetupDraft(draft({ endsAt: null }), now).time).toBeDefined();
    expect(validateMeetupDraft(draft({ startsAt: new Date(now.getTime() + 30 * 60000) }), now).time).toMatch('1시간');
    expect(
      validateMeetupDraft(draft({ endsAt: new Date(2026, 8, 26, 18, 0) }), now).time,
    ).toMatch('뒤여야');
    expect(validateMeetupDraft(draft({ capacity: 1 }), now).capacity).toBeDefined();
    expect(validateMeetupDraft(draft({ capacity: 31 }), now).capacity).toBeDefined();
    expect(validateMeetupDraft(draft({ fee: { type: 'cost', amount: 5000, note: ' ' } }), now).fee).toMatch('어디에');
    expect(validateMeetupDraft(draft({ fee: { type: 'cost', amount: 60000, note: '대관' } }), now).fee).toMatch('50,000원');
    expect(validateMeetupDraft(draft({ title: '출사' }), now).title).toBeDefined();
  });

  it('모델 섭외 촬영회는 막는다', () => {
    expect(looksLikeModelShoot('주말 모델 섭외 인물 촬영회')).toBe(true);
    expect(looksLikeModelShoot('카메라 모델 상관없어요')).toBe(false);
    expect(validateMeetupDraft(draft({ description: '전문 모델 섭외해서 진행합니다' }), now).description).toMatch(
      '촬영회',
    );
  });

  it('초안에서 모임을 만들면 모임장이 첫 참여자다', () => {
    const m = buildMeetup(draft(), 'm1', 'u1');
    expect(m.participantIds).toEqual(['u1']);
    expect(m.place).toEqual({ name: '성수역 2번 출구', district: '성동구' });
  });

  it('대상 유형·연령대 제한을 확인한다', () => {
    const m = buildMeetup(draft({ targetTypes: ['beginner'], targetAges: ['20s'] }), 'm1', 'u1');
    expect(isEligible(m, { type: 'beginner', age: '20s' })).toBe(true);
    expect(isEligible(m, { type: 'amateur', age: '20s' })).toBe(false);
    expect(isEligible(buildMeetup(draft(), 'm2', 'u1'), { type: 'pro', age: '50plus' })).toBe(true);
  });
});

describe('사진 촬영 정보 (운영정책 1절 D2)', () => {
  const iosExif = {
    Make: 'SONY',
    Model: 'ILCE-7M4',
    LensModel: 'FE 35mm F1.8',
    FocalLength: 35,
    FNumber: 1.8,
    ExposureTime: 0.016666,
    ISOSpeedRatings: [1600],
    GPSLatitude: 37.5446,
    GPSLongitude: 127.0557,
  };

  it('iOS 형식(숫자, ISO 배열)을 요약한다', () => {
    const s = summarizeExif(iosExif);
    expect(s).toEqual({
      camera: 'SONY ILCE-7M4',
      lens: 'FE 35mm F1.8',
      focalLength: '35mm',
      aperture: 'f/1.8',
      shutter: '1/60',
      iso: 'ISO 1600',
    });
    expect(formatExifLine(s)).toBe('SONY ILCE-7M4 · 35mm · f/1.8 · 1/60 · ISO 1600');
  });

  it('Android 형식(문자열, 분수)을 요약한다', () => {
    const s = summarizeExif({
      Make: 'samsung',
      Model: 'SM-S928N',
      FocalLength: '6300/1000',
      FNumber: '1.7',
      ExposureTime: '0.004',
      ISOSpeedRatings: '50',
    });
    expect(s).toEqual({
      camera: 'samsung SM-S928N',
      focalLength: '6.3mm',
      aperture: 'f/1.7',
      shutter: '1/250',
      iso: 'ISO 50',
    });
  });

  it('제조사가 모델명에 이미 있으면 한 번만 쓴다', () => {
    expect(summarizeExif({ Make: 'Apple', Model: 'iPhone 15 Pro' }).camera).toBe('iPhone 15 Pro');
    expect(summarizeExif({ Make: 'FUJIFILM', Model: 'X-T5' }).camera).toBe('FUJIFILM X-T5');
    expect(summarizeExif({ Make: 'Canon', Model: 'Canon EOS R6' }).camera).toBe('Canon EOS R6');
  });

  it('긴 노출은 초로 표시한다', () => {
    expect(formatShutter(2)).toBe('2s');
    expect(formatShutter(0.5)).toBe('1/2');
  });

  it('위치 정보가 있었는지 확인한다', () => {
    expect(hasGpsData(iosExif)).toBe(true);
    expect(hasGpsData({ Make: 'SONY' })).toBe(false);
    expect(hasGpsData({ GPSLatitude: null })).toBe(false);
    expect(hasGpsData(null)).toBe(false);
  });

  it('긴 변이 2048px를 넘을 때만 줄인다', () => {
    expect(uploadResize(6000, 4000)).toEqual({ width: 2048 });
    expect(uploadResize(3000, 4500)).toEqual({ height: 2048 });
    expect(uploadResize(1600, 1200)).toBeNull();
  });
});

describe('날짜 표시', () => {
  it('카드와 상세 형식', () => {
    const start = new Date(2026, 9, 4, 18, 30);
    expect(formatShortDateTime(start)).toBe('10.4 (일) 18:30');
    expect(formatRange(start, new Date(2026, 9, 4, 21, 0))).toBe('10월 4일 (일) 18:30 ~ 21:00');
  });

  it('상대 시간', () => {
    expect(relativeTime(new Date(now.getTime() - 20 * 60000), now)).toBe('20분 전');
    expect(relativeTime(new Date(now.getTime() - 3 * 3600000), now)).toBe('3시간 전');
    expect(relativeTime(now, now)).toBe('방금');
  });

  it('이번 주말 판정 (목요일 기준 토·일)', () => {
    expect(isThisWeekend(new Date(2026, 8, 26, 10, 0), now)).toBe(true);
    expect(isThisWeekend(new Date(2026, 8, 27, 23, 0), now)).toBe(true);
    expect(isThisWeekend(new Date(2026, 8, 28, 9, 0), now)).toBe(false);
    expect(isThisWeekend(new Date(2026, 8, 25, 19, 0), now)).toBe(false);
  });

  it('원 단위', () => {
    expect(formatWon(5000)).toBe('5,000원');
    expect(formatWon(50000)).toBe('50,000원');
  });
});
