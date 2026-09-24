// 서버 모드 상태. Supabase에서 화면에 필요한 데이터를 한 번에 불러와 예시 데이터 모드와 같은 모양으로 둔다.
// 동작(actions)은 DB 함수나 insert를 부르고, 성공하면 다시 불러온다. 규칙 검사는 DB가 한다 (docs/08-database.md).
import type { SupabaseClient } from '@supabase/supabase-js';
import { type Context, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useToast } from '../../components/toast';
import { PHOTO_BUCKET } from '../../lib/supabase';
import { type AppState, emptyState, type Store } from '../storeTypes';
import {
  type ChatRow,
  friendlyError,
  meetupDraftToRow,
  type MeetupRow,
  newPostToRow,
  type ParticipantRow,
  type PostRow,
  type ProfileRow,
  profileToRow,
  type ReportRow,
  rpc,
  selects,
  toChat,
  toMeetup,
  toMember,
  toParticipation,
  toPost,
  toReport,
} from './mapping';

const DAY = 24 * 60 * 60 * 1000;
const SIGNED_URL_SECONDS = 60 * 60;

interface Result<T> {
  data: T | null;
  error: unknown;
}

function unwrap<T>(res: Result<T>): T {
  if (res.error) throw res.error;
  return res.data as T;
}

async function fetchAll(client: SupabaseClient, uid: string): Promise<AppState> {
  // 끝난 지 7일이 안 된 모임까지 불러온다 (출석 체크·매너 평가 기간)
  const since = new Date(Date.now() - 7 * DAY).toISOString();
  const [profiles, meetups, parts, noShows, posts, likes, blocks, chats, reports] = await Promise.all([
    client.from('profiles').select(selects.profiles),
    client.from('meetups').select(selects.meetups).eq('status', 'open').gte('ends_at', since).order('starts_at'),
    client.from('meetup_participants').select(selects.participants),
    client.from('meetup_participants').select(selects.myNoShows).eq('user_id', uid).eq('attendance', 'no_show'),
    client.from('posts').select(selects.posts).order('created_at', { ascending: false }).limit(100),
    client.from('post_likes').select(selects.likes),
    client.from('blocks').select(selects.blocks),
    client.from('chat_messages').select(selects.chats).order('created_at').limit(500),
    client.from('reports').select(selects.reports).order('created_at', { ascending: false }),
  ]);

  const profileRows = unwrap(profiles) as unknown as ProfileRow[];
  const meetupRows = unwrap(meetups) as unknown as MeetupRow[];
  const partRows = unwrap(parts) as unknown as ParticipantRow[];
  const noShowRows = unwrap(noShows) as unknown as { meetups: { starts_at: string } | { starts_at: string }[] | null }[];
  const postRows = unwrap(posts) as unknown as PostRow[];

  const noShowDates = noShowRows
    .map((r) => (Array.isArray(r.meetups) ? r.meetups[0] : r.meetups)?.starts_at)
    .filter((d): d is string => !!d);

  // 사진은 비공개 버킷이라 서명된 주소를 받아 보여 준다
  const paths = postRows.map((p) => p.photo_path).filter((p): p is string => !!p);
  const photoUrls = new Map<string, string>();
  if (paths.length > 0) {
    const signed = await client.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const s of unwrap(signed) ?? []) {
      if (s.path && s.signedUrl) photoUrls.set(s.path, s.signedUrl);
    }
  }

  const members = Object.fromEntries(
    profileRows.map((row) => [row.id, toMember(row, row.id === uid ? noShowDates : [])]),
  );

  return {
    ...emptyState(),
    me: members[uid] ?? null,
    members,
    meetups: meetupRows.map((row) => toMeetup(row, partRows)),
    posts: postRows.map((row) => toPost(row, row.photo_path ? photoUrls.get(row.photo_path) : undefined)),
    pending: partRows.filter((p) => p.user_id === uid && p.status === 'pending').map((p) => p.meetup_id),
    blocked: (unwrap(blocks) as unknown as { blocked_id: string }[]).map((b) => b.blocked_id),
    reports: (unwrap(reports) as unknown as ReportRow[]).map(toReport),
    chats: (unwrap(chats) as unknown as ChatRow[]).map(toChat),
    liked: (unwrap(likes) as unknown as { post_id: string }[]).map((l) => l.post_id),
    participations: partRows.map(toParticipation),
    authUserId: uid,
    loading: false,
  };
}

const randomName = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const noop = () => {};

export function ServerStoreProvider({
  client,
  context,
  children,
}: {
  client: SupabaseClient;
  context: Context<Store | null>;
  children: ReactNode;
}) {
  const toast = useToast();
  const [state, setState] = useState<AppState>(() => ({ ...emptyState(), loading: true }));
  const uidRef = useRef<string | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const load = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid) {
      setState({ ...emptyState(), loading: false });
      return;
    }
    try {
      const next = await fetchAll(client, uid);
      // 불러오는 사이에 로그아웃했다면 버린다
      if (uidRef.current === uid) setState(next);
    } catch (error) {
      toast(friendlyError(error));
      setState((s) => ({ ...s, authUserId: uid, loading: false }));
    }
  }, [client, toast]);

  // 로그인 상태가 바뀌면 다시 불러온다
  useEffect(() => {
    let active = true;
    const apply = (uid: string | null) => {
      uidRef.current = uid;
      setState((s) => ({ ...(uid ? s : emptyState()), authUserId: uid, loading: uid !== null }));
      // 인증 콜백 안에서 곧바로 다른 Supabase 호출을 하지 않는다 (콜백이 끝난 뒤 실행)
      setTimeout(() => {
        if (active) void load();
      }, 0);
    };
    void client.auth.getSession().then(({ data }) => {
      if (active) apply(data.session?.user.id ?? null);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user.id ?? null;
      if (uid !== uidRef.current) apply(uid);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client, load]);

  /** 서버에 요청하고, 성공하면 안내를 띄우고 다시 불러온다. 실패하면 이유를 띄운다 */
  const run = useCallback(
    async <T,>(request: () => Promise<T>, done?: (result: T) => string | undefined): Promise<T | undefined> => {
      try {
        const result = await request();
        const message = done?.(result);
        if (message) toast(message);
        await load();
        return result;
      } catch (error) {
        toast(friendlyError(error));
        return undefined;
      }
    },
    [load, toast],
  );

  const actions = useMemo<Store['actions']>(() => {
    const call = async <T,>(name: string, args: Record<string, unknown>) =>
      unwrap((await client.rpc(name, args)) as Result<T>);

    return {
      onboard: async (profile) =>
        (await run(async () => {
          unwrap(await client.from('profiles').insert(profileToRow(profile)));
          return true;
        })) ?? false,

      updateProfile: (change) => {
        const row: Record<string, unknown> = {};
        if (change.type) row.activity_type = change.type;
        if (change.district) row.district = change.district;
        if (change.genres) row.genres = change.genres;
        // 연령대는 본인인증 결과로만 바뀐다
        if (Object.keys(row).length === 0 || !uidRef.current) return;
        void run(async () => unwrap(await client.from('profiles').update(row).eq('id', uidRef.current)));
      },

      join: (meetupId) => {
        const [name, args] = rpc.join(meetupId);
        void run(
          () => call<string>(name, args),
          (status) => (status === 'pending' ? '참여를 신청했어요. 모임장이 승인하면 확정돼요.' : '참여가 확정됐어요.'),
        );
      },

      cancel: (meetupId) => {
        const [name, args] = rpc.cancel(meetupId);
        void run(
          () => call<boolean>(name, args),
          (late) => (late ? '참여를 취소했어요. 시작 24시간 이내라 늦은 취소로 기록됐어요.' : '참여를 취소했어요.'),
        );
      },

      createMeetup: async (draft) =>
        (await run(
          async () =>
            (unwrap(await client.from('meetups').insert(meetupDraftToRow(draft)).select('id').single()) as unknown as { id: string }).id,
          () => '모임을 열었어요.',
        )) ?? null,

      block: (memberId) => {
        void run(async () => unwrap(await client.from('blocks').insert({ blocked_id: memberId })), () => '차단했어요.');
      },

      unblock: (memberId) => {
        void run(async () => unwrap(await client.from('blocks').delete().eq('blocked_id', memberId)), () => '차단을 풀었어요.');
      },

      report: async (kind, targetId, reason, detail) =>
        (await run(async () => {
          unwrap(await client.from('reports').insert({ target_kind: kind, target_id: targetId, reason, detail: detail || null }));
          return true;
        })) ?? false,

      addPost: async (post) =>
        (await run(async () => {
          const uid = uidRef.current;
          if (!uid) throw new Error('not signed in');
          let photoPath: string | null = null;
          if (post.photoUri) {
            // 앱에서 이미 GPS를 지우고 2048px JPEG로 다시 저장한 파일이다
            photoPath = `${uid}/${randomName()}.jpg`;
            const body = await (await fetch(post.photoUri)).arrayBuffer();
            unwrap(await client.storage.from(PHOTO_BUCKET).upload(photoPath, body, { contentType: 'image/jpeg' }));
          }
          try {
            const row = unwrap(await client.from('posts').insert(newPostToRow(post, photoPath)).select('id').single());
            return (row as unknown as { id: string }).id;
          } catch (error) {
            // 글 저장에 실패하면 올린 사진도 지운다
            if (photoPath) await client.storage.from(PHOTO_BUCKET).remove([photoPath]);
            throw error;
          }
        }, () => '올렸어요.')) ?? null,

      answer: (postId, body) => {
        void run(async () => unwrap(await client.from('post_answers').insert({ post_id: postId, body })));
      },

      toggleLike: (postId) => {
        const liked = stateRef.current.liked.includes(postId);
        void run(async () =>
          unwrap(
            liked
              ? await client.from('post_likes').delete().eq('post_id', postId)
              : await client.from('post_likes').insert({ post_id: postId }),
          ),
        );
      },

      chat: (meetupId, body) => {
        // 채팅은 전체를 다시 불러오지 않고 보낸 메시지만 붙인다
        void (async () => {
          try {
            const row = unwrap(
              await client.from('chat_messages').insert({ meetup_id: meetupId, body }).select(selects.chats).single(),
            ) as unknown as ChatRow;
            const message = toChat(row);
            setState((s) => (s.chats.some((c) => c.id === message.id) ? s : { ...s, chats: [...s.chats, message] }));
          } catch (error) {
            toast(friendlyError(error));
          }
        })();
      },

      subscribeChat: (meetupId) => {
        const channel = client
          .channel(`chat:${meetupId}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `meetup_id=eq.${meetupId}` },
            (payload) => {
              const message = toChat(payload.new as ChatRow);
              setState((s) => (s.chats.some((c) => c.id === message.id) ? s : { ...s, chats: [...s.chats, message] }));
            },
          )
          .subscribe();
        return () => {
          void client.removeChannel(channel);
        };
      },

      deleteAccount: () => {
        void (async () => {
          try {
            const [name, args] = rpc.deleteAccount();
            await call(name, args);
            // 계정이 이미 지워져서 서버 로그아웃은 실패하므로 기기의 로그인만 지운다
            await client.auth.signOut({ scope: 'local' });
          } catch (error) {
            toast(friendlyError(error));
          }
        })();
      },

      decide: (meetupId, userId, approve) => {
        const [name, args] = rpc.decide(meetupId, userId, approve);
        void run(() => call(name, args), () => (approve ? '승인했어요.' : '거절했어요.'));
      },

      markAttendance: (meetupId, userId, attended) => {
        const [name, args] = rpc.attendance(meetupId, userId, attended);
        void run(() => call(name, args), () => (attended ? '참석으로 체크했어요.' : '노쇼로 체크했어요.'));
      },

      refresh: load,

      signIn: async (email, password) => {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        return error ? { error: friendlyError(error) } : {};
      },

      signUp: async (email, password) => {
        const { data, error } = await client.auth.signUp({ email: email.trim(), password });
        if (error) return { error: friendlyError(error) };
        if (!data.session) return { info: '가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.' };
        return {};
      },

      signOut: () => {
        void client.auth.signOut();
      },

      // 예시 데이터 모드 전용 시연 도구
      approvePending: noop,
      proto: noop,
    };
  }, [client, load, run, toast]);

  const value = useMemo<Store>(() => ({ mode: 'server', state, actions }), [state, actions]);
  return <context.Provider value={value}>{children}</context.Provider>;
}
