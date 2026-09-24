// DB 행(snake_case)과 앱의 도메인 타입(camelCase) 사이의 변환.
// 테이블 구조는 supabase/migrations/20260924100000_schema.sql 참고.
import type { MeetupDraft } from '../../domain/meetupRules';
import type {
  ActivityType,
  AgeBand,
  Board,
  ChatMessage,
  Difficulty,
  ExifSummary,
  FeedbackTopic,
  Genre,
  Meetup,
  MeetupKind,
  Member,
  Participation,
  Post,
  Report,
  ReportReason,
  ReportTargetKind,
} from '../../domain/types';

export interface StatsRow {
  attended: number;
  no_shows: number;
  late_cancels: number;
  hosted: number;
  manner_avg: number | string | null;
  manner_count: number;
}

export interface ProfileRow {
  id: string;
  display_name: string;
  activity_type: ActivityType;
  age_band: AgeBand | null;
  district: string;
  genres: Genre[] | null;
  bio: string | null;
  is_founding_host: boolean;
  verified_at: string | null;
  // 1:1 관계라 PostgREST는 객체로 주지만, 배열로 오는 경우도 받아 준다
  profile_stats?: StatsRow | StatsRow[] | null;
}

export interface MeetupRow {
  id: string;
  host_id: string;
  kind: MeetupKind;
  title: string;
  description: string;
  genres: Genre[] | null;
  place_name: string;
  district: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  difficulty: Difficulty;
  fee_type: 'free' | 'cost';
  fee_amount: number | null;
  fee_note: string | null;
  target_types: ActivityType[] | null;
  target_ages: AgeBand[] | null;
  requires_approval: boolean;
  status: 'open' | 'canceled';
}

export interface ParticipantRow {
  meetup_id: string;
  user_id: string;
  role: 'host' | 'member';
  status: 'pending' | 'confirmed' | 'declined' | 'canceled';
  attendance: 'attended' | 'no_show' | null;
}

export interface AnswerRow {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface PostRow {
  id: string;
  author_id: string;
  board: Board;
  topic: FeedbackTopic;
  title: string;
  body: string;
  photo_path: string | null;
  exif: Record<string, string> | null;
  gear_note: string | null;
  like_count: number;
  created_at: string;
  post_answers?: AnswerRow[] | null;
}

export interface ChatRow {
  id: string;
  meetup_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface ReportRow {
  id: string;
  target_kind: ReportTargetKind | 'answer' | 'chat_message';
  target_id: string;
  reason: ReportReason;
  detail: string | null;
  created_at: string;
}

const one = <T>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : (v ?? undefined));

export function toMember(row: ProfileRow, noShowDates: string[] = []): Member {
  const s = one(row.profile_stats);
  const manner = s?.manner_avg === null || s?.manner_avg === undefined ? null : Number(s.manner_avg);
  return {
    id: row.id,
    name: row.display_name,
    type: row.activity_type,
    age: row.age_band,
    district: row.district,
    genres: row.genres ?? [],
    bio: row.bio ?? undefined,
    foundingHost: row.is_founding_host,
    verified: row.verified_at !== null,
    stats: {
      attended: s?.attended ?? 0,
      noShows: s?.no_shows ?? 0,
      lateCancels: s?.late_cancels ?? 0,
      hosted: s?.hosted ?? 0,
      manner: Number.isFinite(manner) ? manner : null,
      mannerCount: s?.manner_count ?? 0,
    },
    noShowDates,
  };
}

export function toParticipation(row: ParticipantRow): Participation {
  return { meetupId: row.meetup_id, userId: row.user_id, role: row.role, status: row.status, attendance: row.attendance };
}

/** 확정된 참여자만 participantIds에 넣는다. 모임장이 맨 앞 */
export function toMeetup(row: MeetupRow, participants: ParticipantRow[]): Meetup {
  const confirmed = participants
    .filter((p) => p.meetup_id === row.id && p.status === 'confirmed')
    .sort((a, b) => (a.role === 'host' ? -1 : b.role === 'host' ? 1 : 0))
    .map((p) => p.user_id);
  if (!confirmed.includes(row.host_id)) confirmed.unshift(row.host_id);
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    genres: row.genres ?? [],
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    place: { name: row.place_name, district: row.district },
    capacity: row.capacity,
    difficulty: row.difficulty,
    fee:
      row.fee_type === 'cost' && row.fee_amount !== null
        ? { type: 'cost', amount: row.fee_amount, note: row.fee_note ?? '' }
        : { type: 'free' },
    targetTypes: row.target_types ?? [],
    targetAges: row.target_ages ?? [],
    approval: row.requires_approval,
    hostId: row.host_id,
    participantIds: confirmed,
    description: row.description,
  };
}

export function meetupDraftToRow(d: MeetupDraft) {
  if (!d.startsAt || !d.endsAt) throw new Error('시간이 정해지지 않은 초안이에요.');
  return {
    kind: d.kind,
    title: d.title.trim(),
    description: d.description.trim(),
    genres: d.genres,
    place_name: d.placeName.trim(),
    district: d.district,
    starts_at: d.startsAt.toISOString(),
    ends_at: d.endsAt.toISOString(),
    capacity: d.capacity,
    difficulty: d.difficulty,
    fee_type: d.fee.type,
    fee_amount: d.fee.type === 'cost' ? d.fee.amount : null,
    fee_note: d.fee.type === 'cost' ? d.fee.note.trim() : null,
    target_types: d.targetTypes,
    target_ages: d.targetAges,
    requires_approval: d.approval,
  };
}

// DB의 exif 열은 snake_case 키 6개만 허용한다 (posts_exif_whitelist)
const EXIF_KEYS: [keyof ExifSummary, string][] = [
  ['camera', 'camera'],
  ['lens', 'lens'],
  ['focalLength', 'focal_length'],
  ['aperture', 'aperture'],
  ['shutter', 'shutter'],
  ['iso', 'iso'],
];

export function exifToDb(e: ExifSummary | undefined): Record<string, string> | null {
  if (!e) return null;
  const out: Record<string, string> = {};
  for (const [app, db] of EXIF_KEYS) {
    const v = e[app];
    if (v) out[db] = v;
  }
  return Object.keys(out).length ? out : null;
}

export function exifFromDb(e: Record<string, string> | null): ExifSummary | undefined {
  if (!e) return undefined;
  const out: ExifSummary = {};
  for (const [app, db] of EXIF_KEYS) {
    if (typeof e[db] === 'string') out[app] = e[db];
  }
  return out;
}

export function toPost(row: PostRow, photoUrl?: string): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    board: row.board,
    topic: row.topic,
    title: row.title,
    body: row.body,
    exif: exifFromDb(row.exif),
    gearNote: row.gear_note ?? undefined,
    photoUri: photoUrl,
    createdAt: row.created_at,
    answers: (row.post_answers ?? [])
      .map((a) => ({ id: a.id, authorId: a.author_id, body: a.body, createdAt: a.created_at }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    likes: row.like_count,
  };
}

export function toChat(row: ChatRow): ChatMessage {
  return { id: row.id, meetupId: row.meetup_id, authorId: row.author_id, body: row.body, createdAt: row.created_at };
}

export function toReport(row: ReportRow): Report {
  const kind: ReportTargetKind = row.target_kind === 'meetup' || row.target_kind === 'member' ? row.target_kind : 'post';
  return { id: row.id, targetKind: kind, targetId: row.target_id, reason: row.reason, detail: row.detail ?? '', createdAt: row.created_at };
}

interface ErrorLike {
  message?: string;
  code?: string;
  hint?: string | null;
}

/**
 * 서버 오류를 사용자에게 보여 줄 문장으로 바꾼다.
 * 앱 함수(RPC)의 오류는 hint에 코드가 있고 message가 이미 한국어라 그대로 쓴다.
 */
export function friendlyError(error: unknown): string {
  const e = (error ?? {}) as ErrorLike;
  if (e.hint && e.message && e.code === 'P0001') return e.message;
  if (e.code === '42501') return '권한이 없어요. 본인인증을 마쳤는지 확인해 주세요.';
  if (e.code === '23514') return '입력한 내용이 규칙에 맞지 않아요. 다시 확인해 주세요.';
  if (e.code === '23505') return '이미 처리된 요청이에요.';
  const msg = e.message ?? '';
  if (/Invalid login credentials/i.test(msg)) return '이메일 또는 비밀번호가 맞지 않아요.';
  if (/Email not confirmed/i.test(msg)) return '가입 확인 메일의 링크를 먼저 눌러 주세요.';
  if (/User already registered/i.test(msg)) return '이미 가입한 이메일이에요. 로그인해 주세요.';
  if (/Password should be at least/i.test(msg)) return '비밀번호는 6자 이상이어야 해요.';
  if (/Network request failed|Failed to fetch/i.test(msg)) return '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.';
  return '문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.';
}

// ── 서버에 보내는 모양 (계약 테스트가 SQL 마이그레이션과 맞는지 확인한다) ──

export interface NewPostInput {
  board: Board;
  topic: FeedbackTopic;
  title: string;
  body: string;
  exif?: ExifSummary;
  gearNote?: string;
  photoWidth?: number;
  photoHeight?: number;
  hasIdentifiablePerson?: boolean;
  personConsent?: boolean;
}

export function newPostToRow(p: NewPostInput, photoPath: string | null) {
  return {
    board: p.board,
    topic: p.topic,
    title: p.title.trim(),
    body: p.body.trim(),
    photo_path: photoPath,
    photo_width: photoPath ? (p.photoWidth ?? null) : null,
    photo_height: photoPath ? (p.photoHeight ?? null) : null,
    exif: photoPath ? exifToDb(p.exif) : null,
    gear_note: p.gearNote?.trim() || null,
    has_identifiable_person: !!p.hasIdentifiablePerson,
    person_consent: !!p.personConsent,
  };
}

export function profileToRow(p: { name: string; type: ActivityType; district: string; genres: Genre[] }) {
  return { display_name: p.name.trim(), activity_type: p.type, district: p.district, genres: p.genres };
}

/** 앱이 부르는 DB 함수와 인자 이름. supabase/migrations의 함수 정의와 같아야 한다 */
export const rpc = {
  join: (meetupId: string) => ['join_meetup', { p_meetup_id: meetupId }] as const,
  cancel: (meetupId: string) => ['cancel_participation', { p_meetup_id: meetupId }] as const,
  decide: (meetupId: string, userId: string, approve: boolean) =>
    ['decide_join_request', { p_meetup_id: meetupId, p_user_id: userId, p_approve: approve }] as const,
  attendance: (meetupId: string, userId: string, attended: boolean) =>
    ['mark_attendance', { p_meetup_id: meetupId, p_user_id: userId, p_attended: attended }] as const,
  deleteAccount: () => ['delete_my_account', {}] as const,
};

/** 불러올 열. 계약 테스트가 테이블에 있는 열인지 확인한다 */
export const selects = {
  profiles:
    'id, display_name, activity_type, age_band, district, genres, bio, is_founding_host, verified_at, profile_stats(attended, no_shows, late_cancels, hosted, manner_avg, manner_count)',
  meetups:
    'id, host_id, kind, title, description, genres, place_name, district, starts_at, ends_at, capacity, difficulty, fee_type, fee_amount, fee_note, target_types, target_ages, requires_approval, status',
  participants: 'meetup_id, user_id, role, status, attendance',
  myNoShows: 'meetups(starts_at)',
  posts:
    'id, author_id, board, topic, title, body, photo_path, exif, gear_note, like_count, created_at, post_answers(id, author_id, body, created_at)',
  likes: 'post_id',
  blocks: 'blocked_id',
  chats: 'id, meetup_id, author_id, body, created_at',
  reports: 'id, target_kind, target_id, reason, detail, created_at',
} as const;
