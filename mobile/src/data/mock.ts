// 프로토타입용 예시 데이터. 실제 서버(Supabase)를 연결하면 이 파일은 개발용 시드로만 쓴다.
// 모임 날짜는 앱을 연 날을 기준으로 만들어서 언제 열어도 "다가오는 모임"으로 보인다.
import type { ChatMessage, Meetup, Member, Post } from '../domain/types';

function dayAt(base: Date, addDays: number, hour: number, minute = 0): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + addDays, hour, minute);
}

/** 다가오는 요일. dow: 0=일 ... 6=토. 오늘이 그 요일이면 다음 주 */
function next(base: Date, dow: number, hour: number, minute = 0, weeksLater = 0): Date {
  const diff = (dow - base.getDay() + 7) % 7 || 7;
  return dayAt(base, diff + weeksLater * 7, hour, minute);
}

const ago = (base: Date, minutes: number) => new Date(base.getTime() - minutes * 60000).toISOString();

const stats = (attended: number, hosted: number, manner: number | null, mannerCount: number, noShows = 0) => ({
  attended,
  hosted,
  manner,
  mannerCount,
  noShows,
  lateCancels: 0,
});

export const seedMembers: Member[] = [
  {
    id: 'minsu',
    name: '김민수',
    type: 'amateur',
    age: '30s',
    district: '성동구',
    genres: ['night', 'snap'],
    bio: '야경과 골목 스냅을 찍어요. 매주 토요일 성수동에서 출사 모임을 열어요.',
    foundingHost: true,
    verified: true,
    stats: stats(14, 12, 4.8, 12),
    noShowDates: [],
  },
  {
    id: 'jihoon',
    name: '박지훈',
    type: 'student',
    age: '20s',
    district: '성동구',
    genres: ['film', 'portrait'],
    bio: '사진 전공 3학년. 필름으로 인물과 거리를 찍어요.',
    verified: true,
    stats: stats(9, 5, 4.6, 8),
    noShowDates: [],
  },
  {
    id: 'daeun',
    name: '정다은',
    type: 'pro',
    age: '30s',
    district: '중구',
    genres: ['street', 'snap'],
    bio: '스냅 작가. 을지로와 망원에서 정기 크루를 운영해요.',
    foundingHost: true,
    verified: true,
    stats: stats(22, 18, 4.9, 20),
    noShowDates: [],
  },
  {
    id: 'seoyeon',
    name: '이서연',
    type: 'beginner',
    age: '20s',
    district: '마포구',
    genres: ['night'],
    verified: true,
    stats: stats(2, 0, 5.0, 2),
    noShowDates: [],
  },
  {
    id: 'yujin',
    name: '최유진',
    type: 'amateur',
    age: '40s',
    district: '종로구',
    genres: ['film', 'street'],
    bio: '주말마다 필름 한 롤. 북촌과 서촌을 자주 걸어요.',
    verified: true,
    stats: stats(11, 3, 4.7, 9),
    noShowDates: [],
  },
  {
    id: 'hyunwoo',
    name: '한현우',
    type: 'amateur',
    age: '50plus',
    district: '서초구',
    genres: ['landscape', 'night'],
    bio: '한강 야경과 장노출을 좋아합니다.',
    verified: true,
    stats: stats(30, 9, 4.8, 25),
    noShowDates: [],
  },
  {
    id: 'sora',
    name: '윤소라',
    type: 'beginner',
    age: '30s',
    district: '용산구',
    genres: ['snap'],
    verified: true,
    stats: stats(1, 0, 4.5, 1),
    noShowDates: [],
  },
  {
    id: 'jaemin',
    name: '오재민',
    type: 'student',
    age: '20s',
    district: '광진구',
    genres: ['street'],
    verified: true,
    stats: stats(4, 0, 4.7, 3),
    noShowDates: [],
  },
];

export function seedMeetups(now: Date): Meetup[] {
  return [
    {
      id: 'm-seongsu',
      kind: 'flash',
      title: '성수동 골목 야경 스냅 출사',
      genres: ['night', 'snap'],
      startsAt: next(now, 6, 18, 30).toISOString(),
      endsAt: next(now, 6, 21, 0).toISOString(),
      place: { name: '성수역 2번 출구 앞', district: '성동구' },
      capacity: 10,
      difficulty: 'welcome',
      fee: { type: 'free' },
      targetTypes: ['beginner', 'amateur'],
      targetAges: ['20s', '30s', '40s'],
      approval: true,
      hostId: 'minsu',
      participantIds: ['minsu', 'seoyeon', 'sora', 'jihoon', 'yujin', 'jaemin'],
      description:
        '성수동 골목의 네온과 가로등을 주제로 야경 스냅을 찍어요. 삼각대 없이 손으로 찍는 세팅(고감도·개방 조리개)을 같이 연습합니다. 카메라 종류는 상관없고 폰카도 환영해요. 끝나고 근처 카페에서 서로 사진을 보며 짧게 피드백해요.',
    },
    {
      id: 'm-seoulforest',
      kind: 'flash',
      title: '서울숲 필름 산책',
      genres: ['film'],
      startsAt: next(now, 0, 10, 0).toISOString(),
      endsAt: next(now, 0, 12, 30).toISOString(),
      place: { name: '서울숲역 3번 출구', district: '성동구' },
      capacity: 8,
      difficulty: 'welcome',
      fee: { type: 'cost', amount: 5000, note: '필름 현상·스캔 1롤' },
      targetTypes: [],
      targetAges: [],
      approval: false,
      hostId: 'jihoon',
      participantIds: ['jihoon', 'yujin', 'jaemin'],
      description:
        '필름 카메라 한 대, 필름 한 롤만 챙겨 오세요. 서울숲을 천천히 걸으며 36장을 다 찍고, 끝나면 근처 현상소에 같이 맡겨요. 필름을 처음 쓰는 분은 장전부터 도와드려요.',
    },
    {
      id: 'm-euljiro',
      kind: 'crew',
      title: '을지로 스트리트 번개',
      genres: ['street'],
      startsAt: next(now, 6, 15, 0).toISOString(),
      endsAt: next(now, 6, 17, 30).toISOString(),
      place: { name: '을지로3가역 1번 출구', district: '중구' },
      capacity: 8,
      difficulty: 'intermediate',
      fee: { type: 'free' },
      targetTypes: [],
      targetAges: [],
      approval: true,
      hostId: 'daeun',
      participantIds: ['daeun', 'minsu', 'jihoon', 'yujin', 'hyunwoo', 'jaemin', 'seoyeon', 'sora'],
      description:
        '인쇄소 골목과 노포 사이로 사람과 빛을 찍어요. 모르는 사람의 얼굴이 알아보이게 찍었다면 꼭 먼저 물어봐 주세요. 격주 토요일 정기 크루입니다.',
    },
    {
      id: 'm-banpo',
      kind: 'flash',
      title: '반포 한강 야경 장노출',
      genres: ['night', 'landscape'],
      startsAt: next(now, 5, 19, 30).toISOString(),
      endsAt: next(now, 5, 21, 30).toISOString(),
      place: { name: '반포한강공원 달빛광장 입구', district: '서초구' },
      capacity: 8,
      difficulty: 'intermediate',
      fee: { type: 'free' },
      targetTypes: [],
      targetAges: [],
      approval: false,
      hostId: 'hyunwoo',
      participantIds: ['hyunwoo', 'minsu', 'jaemin'],
      description:
        '달빛무지개분수가 켜지는 시간에 맞춰 장노출을 찍어요. 삼각대는 꼭 챙겨 주세요. ND 필터가 있으면 좋고, 없어도 셔터 속도 조절로 충분히 찍을 수 있어요.',
    },
    {
      id: 'm-bukchon',
      kind: 'flash',
      title: '북촌 한옥 골목 입문 출사',
      genres: ['snap', 'street'],
      startsAt: next(now, 6, 10, 0, 1).toISOString(),
      endsAt: next(now, 6, 12, 0, 1).toISOString(),
      place: { name: '안국역 2번 출구', district: '종로구' },
      capacity: 6,
      difficulty: 'welcome',
      fee: { type: 'free' },
      targetTypes: ['beginner'],
      targetAges: [],
      approval: false,
      hostId: 'yujin',
      participantIds: ['yujin', 'sora'],
      description:
        '카메라를 산 지 얼마 안 된 분들을 위한 모임이에요. 조리개와 셔터 속도가 사진을 어떻게 바꾸는지 골목을 걸으며 하나씩 해 봐요. 거주민이 사는 곳이니 조용히 다녀요.',
    },
    {
      id: 'm-mangwon',
      kind: 'crew',
      title: '망원 한강공원 노을 스냅',
      genres: ['snap', 'landscape'],
      startsAt: next(now, 3, 18, 0).toISOString(),
      endsAt: next(now, 3, 20, 0).toISOString(),
      place: { name: '망원역 2번 출구', district: '마포구' },
      capacity: 12,
      difficulty: 'welcome',
      fee: { type: 'free' },
      targetTypes: [],
      targetAges: [],
      approval: false,
      hostId: 'daeun',
      participantIds: ['daeun', 'seoyeon', 'jihoon', 'minsu', 'jaemin'],
      description:
        '퇴근길에 노을 스냅 한 시간. 역광에서 사람을 찍는 법, 하늘 색을 살리는 노출을 같이 연습해요. 매주 수요일 정기 크루예요.',
    },
  ];
}

export function seedPosts(now: Date): Post[] {
  return [
    {
      id: 'p-night',
      authorId: 'seoyeon',
      board: 'feedback',
      topic: 'exposure',
      title: '야경 노출과 구도 봐주세요',
      body: '삼각대 없이 찍었는데 너무 어두운가요? 하늘과 건물 경계가 답답해 보이는 것 같아요.',
      exif: { camera: 'SONY ILCE-7M4', focalLength: '35mm', aperture: 'f/1.8', shutter: '1/60', iso: 'ISO 1600' },
      createdAt: ago(now, 20),
      answers: [],
      likes: 3,
    },
    {
      id: 'p-backlight',
      authorId: 'jihoon',
      board: 'feedback',
      topic: 'retouch',
      title: '역광 인물, 피부톤 보정이 어색한가요?',
      body: '노을 역광에서 찍고 노출을 올렸는데 얼굴이 회색빛이 돌아요. 찍힌 친구에게 올려도 된다고 허락받았어요.',
      exif: { camera: 'FUJIFILM X-T5', focalLength: '56mm', aperture: 'f/1.2', shutter: '1/500', iso: 'ISO 200' },
      createdAt: ago(now, 65),
      answers: [],
      likes: 5,
    },
    {
      id: 'p-film',
      authorId: 'yujin',
      board: 'feedback',
      topic: 'film',
      title: '필름 스캔 색감, 이게 정상인가요?',
      body: '현상소 스캔을 받았는데 전체적으로 초록빛이 돌아요. 제 노출 문제인지 스캔 문제인지 궁금해요.',
      gearNote: 'Nikon FM2 · 50mm · Portra 400',
      createdAt: ago(now, 190),
      answers: [
        {
          id: 'a1',
          authorId: 'hyunwoo',
          body: '그늘 쪽이 한 스톱 정도 부족해 보여요. 포트라는 노출이 모자라면 초록빛이 잘 올라와요. 다음엔 그늘 기준으로 한 스톱 더 주세요.',
          createdAt: ago(now, 150),
        },
        {
          id: 'a2',
          authorId: 'daeun',
          body: '스캔할 때 색 보정을 따로 요청할 수 있어요. 같은 롤의 다른 컷도 초록빛이면 스캔 쪽일 가능성이 커요.',
          createdAt: ago(now, 120),
        },
      ],
      likes: 9,
    },
    {
      id: 'p-price',
      authorId: 'daeun',
      board: 'lounge',
      topic: 'general',
      title: '스냅 촬영 단가, 요즘 이렇게 받아요',
      body: '1시간 스냅 기준으로 보정 컷 수와 원본 제공 여부에 따라 나눠서 받고 있어요. 계약서에 꼭 넣는 항목도 정리해 봤어요.',
      createdAt: ago(now, 60 * 26),
      answers: [],
      likes: 24,
    },
    {
      id: 'p-firstcam',
      authorId: 'sora',
      board: 'qna',
      topic: 'gear',
      title: '첫 카메라, 중고로 사도 괜찮을까요?',
      body: '예산이 80만 원 정도예요. 중고로 사면 어떤 걸 확인해야 하는지 알려 주세요.',
      createdAt: ago(now, 60 * 30),
      answers: [
        {
          id: 'a3',
          authorId: 'minsu',
          body: '셔터 횟수, 센서 먼지, 렌즈 곰팡이 세 가지만 직거래로 확인하세요. 첫 카메라는 중고도 충분해요.',
          createdAt: ago(now, 60 * 29),
        },
      ],
      likes: 31,
    },
    {
      id: 'p-rain',
      authorId: 'hyunwoo',
      board: 'lounge',
      topic: 'general',
      title: '이번 주말 비 예보, 그래도 갈 만한 출사지',
      body: '비 오는 날 반영이 예쁜 곳 몇 군데 모아 봤어요. 우산 쓰고 한 손으로 찍기 좋은 곳 위주입니다.',
      createdAt: ago(now, 60 * 50),
      answers: [],
      likes: 12,
    },
  ];
}

export function seedChats(now: Date): ChatMessage[] {
  return [
    { id: 'c1', meetupId: 'm-seongsu', authorId: 'minsu', body: '토요일 18:30 성수역 2번 출구 앞에서 봬요. 초록색 모자 쓰고 있을게요.', createdAt: ago(now, 180) },
    { id: 'c2', meetupId: 'm-seongsu', authorId: 'seoyeon', body: '폰으로만 찍어도 괜찮을까요?', createdAt: ago(now, 150) },
    { id: 'c3', meetupId: 'm-seongsu', authorId: 'minsu', body: '물론이에요. 야간 모드 켜고 오시면 돼요.', createdAt: ago(now, 140) },
  ];
}

export interface Guide {
  title: string;
  tag: string;
}

/** 홈의 연령대별 추천 정보 (플랜 3절 ③) */
export const guidesByAge: Record<Member['age'], Guide[]> = {
  '20s': [
    { title: '폰카로 스냅 느낌 내는 세 가지 설정', tag: '가이드 · 폰카' },
    { title: '첫 미러리스, 중고로 살 때 확인할 것', tag: '장비 · 입문자 라운지 인기글' },
  ],
  '30s': [
    { title: '아이 사진, 실내에서 흔들림 없이 찍는 셔터 속도', tag: '가이드 · 가족 사진' },
    { title: '가성비 여행 줌렌즈, 어떤 기준으로 고를까', tag: '장비 · 아마추어 라운지 인기글' },
  ],
  '40s': [
    { title: '여행 사진, 사람과 풍경을 한 장에 담는 구도', tag: '가이드 · 여행' },
    { title: '장비를 바꾼다면 바디보다 렌즈부터인 이유', tag: '장비 · 아마추어 라운지 인기글' },
  ],
  '50plus': [
    { title: '가을 야생화 출사지, 서울에서 한 시간 안', tag: '가이드 · 풍경' },
    { title: '기초 보정 쉽게 배우기: 밝기와 수평만 먼저', tag: '가이드 · 보정' },
  ],
};
