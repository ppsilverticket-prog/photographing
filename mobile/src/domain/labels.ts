import type {
  ActivityType,
  AgeBand,
  Board,
  Difficulty,
  FeedbackTopic,
  Genre,
  MeetupKind,
  ReportReason,
} from './types';

export const activityTypes: { value: ActivityType; label: string; hint: string }[] = [
  { value: 'beginner', label: '입문자', hint: '폰카·카메라 입문 1년 미만' },
  { value: 'amateur', label: '아마추어', hint: '취미로 꾸준히 촬영해요' },
  { value: 'student', label: '학생 / 전공자', hint: '사진 전공, 동아리 활동' },
  { value: 'pro', label: '상업 작가', hint: '웨딩·프로필·제품 등 수익 활동' },
];

export const activityLabel: Record<ActivityType, string> = {
  beginner: '입문자',
  amateur: '아마추어',
  student: '학생',
  pro: '작가',
};

export const ageBands: { value: AgeBand; label: string }[] = [
  { value: '20s', label: '20대' },
  { value: '30s', label: '30대' },
  { value: '40s', label: '40대' },
  { value: '50plus', label: '50대 이상' },
];

export const ageLabel: Record<AgeBand, string> = {
  '20s': '20대',
  '30s': '30대',
  '40s': '40대',
  '50plus': '50대 이상',
};

export const genres: { value: Genre; label: string }[] = [
  { value: 'landscape', label: '풍경' },
  { value: 'portrait', label: '인물' },
  { value: 'snap', label: '스냅' },
  { value: 'film', label: '필름' },
  { value: 'street', label: '스트리트' },
  { value: 'night', label: '야경' },
];

export const genreLabel: Record<Genre, string> = Object.fromEntries(
  genres.map((g) => [g.value, g.label]),
) as Record<Genre, string>;

export const difficultyLabel: Record<Difficulty, string> = {
  welcome: '입문 환영',
  intermediate: '중급',
  advanced: '상급',
};

export const kindLabel: Record<MeetupKind, string> = {
  flash: '번개 출사',
  crew: '정기 크루',
};

export const boardLabel: Record<Board, string> = {
  feedback: '피드백 요청',
  lounge: '라운지',
  qna: 'Q&A',
};

export const topicLabel: Record<FeedbackTopic, string> = {
  exposure: '노출·구도',
  retouch: '보정',
  film: '필름',
  gear: '장비',
  general: '일반',
};

/** 초기 운영 지역 (플랜 8절: 서울만) */
export const districts = [
  '성동구',
  '중구',
  '종로구',
  '마포구',
  '용산구',
  '서초구',
  '강남구',
  '송파구',
  '영등포구',
  '광진구',
];

export const reportReasons: { value: ReportReason; label: string; hint: string }[] = [
  { value: 'emergency', label: '지금 위험해요', hint: '모임 중 위협, 폭력, 따라옴' },
  { value: 'illegal_filming', label: '불법 촬영', hint: '몰래 찍기, 신체 부위 촬영, 성적인 사진' },
  { value: 'portrait_rights', label: '내 사진이 동의 없이 올라왔어요', hint: '초상권 침해' },
  { value: 'harassment', label: '괴롭힘·혐오·성희롱', hint: '원치 않는 연락, 만남 요구, 모욕' },
  { value: 'defamation', label: '명예훼손·사생활 침해', hint: '거짓 소문, 개인 정보 노출' },
  { value: 'copyright', label: '사진 도용', hint: '내가 찍은 사진을 다른 사람이 올렸어요' },
  { value: 'spam', label: '광고·홍보', hint: '허락받지 않은 영업, 외부 모집' },
  { value: 'no_show', label: '노쇼·모임 운영 문제', hint: '모임장 무단 취소, 노쇼 기록 이의' },
  { value: 'other', label: '기타', hint: '' },
];
