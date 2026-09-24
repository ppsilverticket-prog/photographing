// 예시 데이터 모드(local)와 서버 모드(server)가 함께 쓰는 상태와 동작의 모양.
// 화면은 이 모양만 알고, 어느 모드인지는 거의 신경 쓰지 않는다.
import type { MeetupDraft } from '../domain/meetupRules';
import type {
  ActivityType,
  AgeBand,
  Board,
  ChatMessage,
  ExifSummary,
  FeedbackTopic,
  Genre,
  Meetup,
  Member,
  Participation,
  Post,
  Report,
  ReportReason,
  ReportTargetKind,
} from '../domain/types';

export interface OnboardingProfile {
  name: string;
  type: ActivityType;
  /** 예시 데이터 모드에서만 직접 고른다. 서버 모드는 본인인증 결과로 정해진다 */
  age: AgeBand | null;
  genres: Genre[];
  district: string;
}

export interface AppState {
  me: Member | null;
  members: Record<string, Member>;
  meetups: Meetup[];
  posts: Post[];
  /** 모임장 승인을 기다리는 내 참여 신청 */
  pending: string[];
  blocked: string[];
  reports: Report[];
  chats: ChatMessage[];
  liked: string[];
  /** 서버 모드: 내가 볼 수 있는 참여 기록 (모임장 화면의 승인·출석에 쓴다) */
  participations: Participation[];
  /** 서버 모드: 로그인한 계정. 로그인했지만 프로필이 없으면 me는 null이다 */
  authUserId: string | null;
  /** 서버 모드: 처음 불러오는 중 */
  loading: boolean;
}

export interface NewPost {
  board: Board;
  topic: FeedbackTopic;
  title: string;
  body: string;
  exif?: ExifSummary;
  gearNote?: string;
  /** 기기에 있는 사진 파일 주소. 서버 모드에서는 올린 뒤 저장소 경로로 바뀐다 */
  photoUri?: string;
  photoWidth?: number;
  photoHeight?: number;
  hasIdentifiablePerson?: boolean;
  personConsent?: boolean;
}

export type ProfileChange = Partial<Pick<Member, 'type' | 'age' | 'district' | 'genres'>>;

export interface AuthResult {
  /** 실패했을 때 보여 줄 문장 */
  error?: string;
  /** 성공했지만 안내가 필요할 때 (예: 확인 메일을 보냈어요) */
  info?: string;
}

export interface StoreActions {
  onboard(profile: OnboardingProfile): Promise<boolean>;
  updateProfile(change: ProfileChange): void;
  join(meetupId: string): void;
  cancel(meetupId: string): void;
  createMeetup(draft: MeetupDraft): Promise<string | null>;
  block(memberId: string): void;
  unblock(memberId: string): void;
  report(kind: ReportTargetKind, targetId: string, reason: ReportReason, detail: string): Promise<boolean>;
  addPost(post: NewPost): Promise<string | null>;
  answer(postId: string, body: string): void;
  toggleLike(postId: string): void;
  chat(meetupId: string, body: string): void;
  deleteAccount(): void;
  /** 모임장: 참여 신청 승인·거절 */
  decide(meetupId: string, userId: string, approve: boolean): void;
  /** 모임장: 출석 체크 */
  markAttendance(meetupId: string, userId: string, attended: boolean): void;
  /** 모임 채팅을 실시간으로 받는다. 돌려준 함수를 부르면 멈춘다 */
  subscribeChat(meetupId: string): () => void;
  refresh(): Promise<void>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string): Promise<AuthResult>;
  signOut(): void;
  // 예시 데이터 모드 전용 (시연 도구)
  approvePending(meetupId: string): void;
  proto(change: 'foundingHost' | 'addNoShow' | 'clearNoShows'): void;
}

export interface Store {
  mode: 'local' | 'server';
  state: AppState;
  actions: StoreActions;
}

export function emptyState(): AppState {
  return {
    me: null,
    members: {},
    meetups: [],
    posts: [],
    pending: [],
    blocked: [],
    reports: [],
    chats: [],
    liked: [],
    participations: [],
    authUserId: null,
    loading: false,
  };
}
