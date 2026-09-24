// 앱 상태. 서버 설정(mobile/.env.local)이 있으면 Supabase를, 없으면 기기 메모리의 예시 데이터를 쓴다.
// 예시 데이터 모드는 앱을 다시 열면 처음 상태로 돌아간다. 인터뷰 시연용이다.
import { createContext, type ReactNode, useContext, useMemo, useReducer } from 'react';

import { buildMeetup, type MeetupDraft } from '../domain/meetupRules';
import { classifyCancellation } from '../domain/noShow';
import type { Answer, ChatMessage, Meetup, Member, Post, Report } from '../domain/types';
import { supabase } from '../lib/supabase';
import { seedChats, seedMeetups, seedMembers, seedPosts } from './mock';
import { ServerStoreProvider } from './server/serverStore';
import {
  type AppState,
  emptyState,
  type NewPost,
  type OnboardingProfile,
  type ProfileChange,
  type Store,
} from './storeTypes';

export type { AppState, OnboardingProfile, Store } from './storeTypes';

/** 예시 데이터 모드에서 나를 가리키는 id */
export const ME = 'me';

type Action =
  | { type: 'onboard'; profile: OnboardingProfile }
  | { type: 'updateProfile'; change: ProfileChange }
  | { type: 'join'; meetupId: string }
  | { type: 'approvePending'; meetupId: string }
  | { type: 'cancel'; meetupId: string; at: Date }
  | { type: 'createMeetup'; meetup: Meetup }
  | { type: 'block'; memberId: string }
  | { type: 'unblock'; memberId: string }
  | { type: 'report'; report: Report }
  | { type: 'addPost'; post: Post }
  | { type: 'answer'; postId: string; answer: Answer }
  | { type: 'toggleLike'; postId: string }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'deleteAccount' }
  | { type: 'proto'; change: 'foundingHost' | 'addNoShow' | 'clearNoShows' };

export function initialState(now = new Date()): AppState {
  return {
    ...emptyState(),
    members: Object.fromEntries(seedMembers.map((m) => [m.id, m])),
    meetups: seedMeetups(now),
    posts: seedPosts(now),
    chats: seedChats(now),
  };
}

function withMe(state: AppState, me: Member): AppState {
  return { ...state, me, members: { ...state.members, [ME]: me } };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'onboard': {
      const me: Member = {
        id: ME,
        ...action.profile,
        verified: true,
        stats: { attended: 0, noShows: 0, lateCancels: 0, hosted: 0, manner: null, mannerCount: 0 },
        noShowDates: [],
      };
      return withMe(state, me);
    }
    case 'updateProfile':
      return state.me ? withMe(state, { ...state.me, ...action.change }) : state;
    case 'join': {
      const meetup = state.meetups.find((m) => m.id === action.meetupId);
      if (!meetup || meetup.participantIds.includes(ME)) return state;
      if (meetup.approval) {
        return state.pending.includes(meetup.id) ? state : { ...state, pending: [...state.pending, meetup.id] };
      }
      return {
        ...state,
        meetups: state.meetups.map((m) =>
          m.id === meetup.id ? { ...m, participantIds: [...m.participantIds, ME] } : m,
        ),
      };
    }
    case 'approvePending':
      return {
        ...state,
        pending: state.pending.filter((id) => id !== action.meetupId),
        meetups: state.meetups.map((m) =>
          m.id === action.meetupId && !m.participantIds.includes(ME)
            ? { ...m, participantIds: [...m.participantIds, ME] }
            : m,
        ),
      };
    case 'cancel': {
      if (state.pending.includes(action.meetupId)) {
        return { ...state, pending: state.pending.filter((id) => id !== action.meetupId) };
      }
      const meetup = state.meetups.find((m) => m.id === action.meetupId);
      if (!meetup || !state.me || !meetup.participantIds.includes(ME)) return state;
      const late = classifyCancellation(new Date(meetup.startsAt), action.at) === 'late';
      const next = {
        ...state,
        meetups: state.meetups.map((m) =>
          m.id === meetup.id ? { ...m, participantIds: m.participantIds.filter((id) => id !== ME) } : m,
        ),
      };
      if (!late) return next;
      return withMe(next, {
        ...state.me,
        stats: { ...state.me.stats, lateCancels: state.me.stats.lateCancels + 1 },
      });
    }
    case 'createMeetup': {
      if (!state.me) return state;
      const next = { ...state, meetups: [action.meetup, ...state.meetups] };
      return withMe(next, { ...state.me, stats: { ...state.me.stats, hosted: state.me.stats.hosted + 1 } });
    }
    case 'block':
      return state.blocked.includes(action.memberId)
        ? state
        : { ...state, blocked: [...state.blocked, action.memberId] };
    case 'unblock':
      return { ...state, blocked: state.blocked.filter((id) => id !== action.memberId) };
    case 'report':
      return { ...state, reports: [action.report, ...state.reports] };
    case 'addPost':
      return { ...state, posts: [action.post, ...state.posts] };
    case 'answer':
      return {
        ...state,
        posts: state.posts.map((p) =>
          p.id === action.postId ? { ...p, answers: [...p.answers, action.answer] } : p,
        ),
      };
    case 'toggleLike': {
      const liked = state.liked.includes(action.postId);
      return {
        ...state,
        liked: liked ? state.liked.filter((id) => id !== action.postId) : [...state.liked, action.postId],
        posts: state.posts.map((p) => (p.id === action.postId ? { ...p, likes: p.likes + (liked ? -1 : 1) } : p)),
      };
    }
    case 'chat':
      return { ...state, chats: [...state.chats, action.message] };
    case 'deleteAccount':
      return initialState();
    case 'proto': {
      if (!state.me) return state;
      const me = state.me;
      if (action.change === 'foundingHost') return withMe(state, { ...me, foundingHost: !me.foundingHost });
      if (action.change === 'clearNoShows') {
        return withMe(state, { ...me, noShowDates: [], stats: { ...me.stats, noShows: 0 } });
      }
      const at = new Date().toISOString();
      return withMe(state, {
        ...me,
        noShowDates: [...me.noShowDates, at],
        stats: { ...me.stats, noShows: me.stats.noShows + 1 },
      });
    }
  }
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const noop = () => {};

function useLocalStore(): Store {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState());

  const actions = useMemo<Store['actions']>(
    () => ({
      onboard: async (profile) => {
        dispatch({ type: 'onboard', profile });
        return true;
      },
      updateProfile: (change) => dispatch({ type: 'updateProfile', change }),
      join: (meetupId) => dispatch({ type: 'join', meetupId }),
      approvePending: (meetupId) => dispatch({ type: 'approvePending', meetupId }),
      cancel: (meetupId) => dispatch({ type: 'cancel', meetupId, at: new Date() }),
      createMeetup: async (draft: MeetupDraft) => {
        const id = newId('m');
        dispatch({ type: 'createMeetup', meetup: buildMeetup(draft, id, ME) });
        return id;
      },
      block: (memberId) => dispatch({ type: 'block', memberId }),
      unblock: (memberId) => dispatch({ type: 'unblock', memberId }),
      report: async (targetKind, targetId, reason, detail) => {
        dispatch({
          type: 'report',
          report: { id: newId('r'), targetKind, targetId, reason, detail, createdAt: new Date().toISOString() },
        });
        return true;
      },
      addPost: async (post: NewPost) => {
        const id = newId('p');
        dispatch({
          type: 'addPost',
          post: {
            id,
            authorId: ME,
            board: post.board,
            topic: post.topic,
            title: post.title,
            body: post.body,
            exif: post.exif,
            gearNote: post.gearNote,
            photoUri: post.photoUri,
            createdAt: new Date().toISOString(),
            answers: [],
            likes: 0,
          },
        });
        return id;
      },
      answer: (postId, body) =>
        dispatch({
          type: 'answer',
          postId,
          answer: { id: newId('a'), authorId: ME, body, createdAt: new Date().toISOString() },
        }),
      toggleLike: (postId) => dispatch({ type: 'toggleLike', postId }),
      chat: (meetupId, body) =>
        dispatch({
          type: 'chat',
          message: { id: newId('c'), meetupId, authorId: ME, body, createdAt: new Date().toISOString() },
        }),
      deleteAccount: () => dispatch({ type: 'deleteAccount' }),
      proto: (change) => dispatch({ type: 'proto', change }),
      // 아래는 서버 모드에서만 의미가 있다
      decide: noop,
      markAttendance: noop,
      subscribeChat: () => noop,
      refresh: async () => {},
      signIn: async () => ({}),
      signUp: async () => ({}),
      signOut: noop,
    }),
    [],
  );

  return useMemo(() => ({ mode: 'local' as const, state, actions }), [state, actions]);
}

const StoreContext = createContext<Store | null>(null);

function LocalStoreProvider({ children }: { children: ReactNode }) {
  const value = useLocalStore();
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  if (supabase) {
    return (
      <ServerStoreProvider client={supabase} context={StoreContext}>
        {children}
      </ServerStoreProvider>
    );
  }
  return <LocalStoreProvider>{children}</LocalStoreProvider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreProvider 안에서만 쓸 수 있어요.');
  return store;
}

/** 온보딩을 마친 뒤의 화면에서 쓴다 */
export function useMe(): Member {
  const { state } = useStore();
  if (!state.me) throw new Error('가입 전에는 이 화면을 열 수 없어요.');
  return state.me;
}

/** 내 id. 예시 데이터 모드는 'me', 서버 모드는 계정 id */
export function useMyId(): string {
  const { state } = useStore();
  return state.me?.id ?? state.authUserId ?? '';
}

/** 차단한 사람의 모임과 글은 보이지 않는다 (운영정책 3절) */
export function useVisible() {
  const { state } = useStore();
  return useMemo(() => {
    const hidden = new Set(state.blocked);
    return {
      meetups: state.meetups.filter((m) => !hidden.has(m.hostId)),
      posts: state.posts.filter((p) => !hidden.has(p.authorId)),
    };
  }, [state.meetups, state.posts, state.blocked]);
}
