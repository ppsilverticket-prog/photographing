export type ActivityType = 'beginner' | 'amateur' | 'student' | 'pro';
export type AgeBand = '20s' | '30s' | '40s' | '50plus';
export type Genre = 'landscape' | 'portrait' | 'snap' | 'film' | 'street' | 'night';
export type Difficulty = 'welcome' | 'intermediate' | 'advanced';
export type MeetupKind = 'flash' | 'crew';

export interface MemberStats {
  attended: number;
  noShows: number;
  /** 시작 24시간 이내 취소 횟수 */
  lateCancels: number;
  hosted: number;
  /** 매너 평가 평균 (5점 만점). 평가가 없으면 null */
  manner: number | null;
  mannerCount: number;
}

export interface Member {
  id: string;
  name: string;
  type: ActivityType;
  /** 서버 모드에서는 본인인증 결과로 정해진다. 인증 전에는 null */
  age: AgeBand | null;
  district: string;
  genres: Genre[];
  bio?: string;
  foundingHost?: boolean;
  verified: boolean;
  stats: MemberStats;
  /** 최근 노쇼 시각 (ISO). 노쇼 제한 계산에 쓴다 */
  noShowDates: string[];
}

export type Fee = { type: 'free' } | { type: 'cost'; amount: number; note: string };

export interface Meetup {
  id: string;
  kind: MeetupKind;
  title: string;
  genres: Genre[];
  startsAt: string;
  endsAt: string;
  place: { name: string; district: string };
  capacity: number;
  difficulty: Difficulty;
  fee: Fee;
  /** 비어 있으면 누구나 */
  targetTypes: ActivityType[];
  /** 비어 있으면 모든 연령대 */
  targetAges: AgeBand[];
  approval: boolean;
  hostId: string;
  participantIds: string[];
  description: string;
}

export interface ExifSummary {
  camera?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  shutter?: string;
  iso?: string;
}

export type Board = 'feedback' | 'lounge' | 'qna';
export type FeedbackTopic = 'exposure' | 'retouch' | 'film' | 'gear' | 'general';

export interface Answer {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Post {
  id: string;
  authorId: string;
  board: Board;
  topic: FeedbackTopic;
  title: string;
  body: string;
  exif?: ExifSummary;
  /** 필름 등 EXIF가 없는 사진에 작성자가 직접 적는 정보 */
  gearNote?: string;
  photoUri?: string;
  createdAt: string;
  answers: Answer[];
  likes: number;
}

export type ReportReason =
  | 'emergency'
  | 'illegal_filming'
  | 'portrait_rights'
  | 'harassment'
  | 'defamation'
  | 'copyright'
  | 'spam'
  | 'no_show'
  | 'other';

export type ReportTargetKind = 'meetup' | 'member' | 'post';

export interface Report {
  id: string;
  targetKind: ReportTargetKind;
  targetId: string;
  reason: ReportReason;
  detail: string;
  createdAt: string;
}

/** 모임 참여 기록. 모임장 화면(승인·출석)에 쓴다 */
export interface Participation {
  meetupId: string;
  userId: string;
  role: 'host' | 'member';
  status: 'pending' | 'confirmed' | 'declined' | 'canceled';
  attendance: 'attended' | 'no_show' | null;
}

export interface ChatMessage {
  id: string;
  meetupId: string;
  authorId: string;
  body: string;
  createdAt: string;
}
