// 서버에 연결하지 않고도 앱과 DB가 어긋나지 않았는지 확인한다.
// supabase/migrations의 SQL을 읽어서 열 이름, 권한, 함수 인자를 앱 코드와 맞춰 본다.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import type { MeetupDraft } from '../../../domain/meetupRules';
import {
  exifFromDb,
  exifToDb,
  friendlyError,
  meetupDraftToRow,
  newPostToRow,
  profileToRow,
  rpc,
  selects,
  toMeetup,
  toMember,
  toPost,
} from '../mapping';

const MIGRATIONS = join(__dirname, '../../../../../supabase/migrations');
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
  .join('\n');

/** create table public.X ( ... ); 에서 열 이름 목록 */
function tableColumns(table: string): string[] {
  const m = new RegExp(`create table public\\.${table} \\(([\\s\\S]*?)\\n\\);`).exec(sql);
  if (!m) throw new Error(`테이블 ${table}을 찾지 못했다`);
  return m[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[a-z_]+ /.test(l) && !/^(constraint|primary|check|unique)\b/.test(l))
    .map((l) => l.split(' ')[0]);
}

/** grant insert (a, b) on public.X to authenticated; 의 열 목록 */
function grantedColumns(kind: 'insert' | 'update', table: string): string[] {
  const m = new RegExp(`grant ${kind} \\(([^)]*)\\) on public\\.${table} to authenticated`).exec(sql);
  if (!m) throw new Error(`${table}의 ${kind} 권한을 찾지 못했다`);
  return m[1].split(',').map((c) => c.trim());
}

/** "a, b, rel(c, d)" → { own: [a, b], embeds: { rel: [c, d] } } */
function parseSelect(s: string) {
  const embeds: Record<string, string[]> = {};
  const own = s
    .replace(/([a-z_]+)\(([^)]*)\)/g, (_, rel: string, cols: string) => {
      embeds[rel] = cols.split(',').map((c) => c.trim());
      return '';
    })
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  return { own, embeds };
}

describe('앱과 DB의 계약', () => {
  const draft: MeetupDraft = {
    kind: 'flash',
    title: '성수동 골목 야경',
    placeName: '성수역 2번 출구',
    district: '성동구',
    startsAt: new Date('2026-10-03T09:30:00Z'),
    endsAt: new Date('2026-10-03T12:00:00Z'),
    capacity: 8,
    difficulty: 'welcome',
    fee: { type: 'cost', amount: 5000, note: ' 장소 대여비 ' },
    genres: ['night'],
    targetTypes: [],
    targetAges: ['20s'],
    approval: true,
    description: '골목 네온을 주제로 야경을 찍어요.',
  };

  it('앱이 insert하는 열은 모두 DB가 허용한 열이다', () => {
    expect(grantedColumns('insert', 'meetups')).toEqual(expect.arrayContaining(Object.keys(meetupDraftToRow(draft))));
    const post = newPostToRow({ board: 'feedback', topic: 'exposure', title: '제목입니다', body: '본문은 열 자 이상이에요' }, 'u/a.jpg');
    expect(grantedColumns('insert', 'posts')).toEqual(expect.arrayContaining(Object.keys(post)));
    const profile = profileToRow({ name: '테스트', type: 'amateur', district: '성동구', genres: [] });
    expect(grantedColumns('insert', 'profiles')).toEqual(expect.arrayContaining(Object.keys(profile)));
    for (const [table, cols] of [
      ['post_answers', ['post_id', 'body']],
      ['post_likes', ['post_id']],
      ['blocks', ['blocked_id']],
      ['chat_messages', ['meetup_id', 'body']],
      ['reports', ['target_kind', 'target_id', 'reason', 'detail']],
    ] as const) {
      expect(grantedColumns('insert', table)).toEqual(expect.arrayContaining([...cols]));
    }
    expect(grantedColumns('update', 'profiles')).toEqual(expect.arrayContaining(['activity_type', 'district', 'genres']));
  });

  it('앱이 부르는 함수는 같은 인자 이름으로 DB에 있다', () => {
    for (const make of Object.values(rpc)) {
      const [name, args] = (make as (...a: unknown[]) => readonly [string, Record<string, unknown>])('x', 'y', true);
      const m = new RegExp(`create function public\\.${name}\\(([^)]*)\\)`).exec(sql);
      expect(m).not.toBeNull();
      const params = (m?.[1] ?? '')
        .split(',')
        .map((p) => p.trim().split(/\s+/)[0])
        .filter(Boolean);
      expect(Object.keys(args).sort()).toEqual(params.sort());
    }
  });

  it('앱이 불러오는 열은 모두 테이블에 있다', () => {
    const tableOf: Record<keyof typeof selects, string> = {
      profiles: 'profiles',
      meetups: 'meetups',
      participants: 'meetup_participants',
      myNoShows: 'meetup_participants',
      posts: 'posts',
      likes: 'post_likes',
      blocks: 'blocks',
      chats: 'chat_messages',
      reports: 'reports',
    };
    const relTable: Record<string, string> = { profile_stats: 'profile_stats', meetups: 'meetups', post_answers: 'post_answers' };
    for (const [key, s] of Object.entries(selects)) {
      const { own, embeds } = parseSelect(s);
      expect(tableColumns(tableOf[key as keyof typeof selects])).toEqual(expect.arrayContaining(own));
      for (const [rel, cols] of Object.entries(embeds)) {
        expect(tableColumns(relTable[rel])).toEqual(expect.arrayContaining(cols));
      }
    }
  });

  it('EXIF 키는 DB가 허용하는 6개와 같다', () => {
    const m = /exif - array\[([^\]]*)\]/.exec(sql);
    const allowed = (m?.[1] ?? '').split(',').map((k) => k.trim().replace(/'/g, ''));
    const all = exifToDb({ camera: 'a', lens: 'b', focalLength: 'c', aperture: 'd', shutter: 'e', iso: 'f' });
    expect(Object.keys(all ?? {}).sort()).toEqual(allowed.sort());
  });
});

describe('변환', () => {
  it('프로필과 통계를 회원으로 바꾼다 (통계가 배열로 와도 된다)', () => {
    const m = toMember({
      id: 'u1',
      display_name: '김민수',
      activity_type: 'amateur',
      age_band: null,
      district: '성동구',
      genres: null,
      bio: null,
      is_founding_host: true,
      verified_at: null,
      profile_stats: [{ attended: 3, no_shows: 1, late_cancels: 0, hosted: 2, manner_avg: '4.50', manner_count: 2 }],
    });
    expect(m).toMatchObject({ age: null, genres: [], foundingHost: true, verified: false });
    expect(m.stats).toEqual({ attended: 3, noShows: 1, lateCancels: 0, hosted: 2, manner: 4.5, mannerCount: 2 });
  });

  it('모임은 확정 참여자만 세고 모임장이 맨 앞', () => {
    const m = toMeetup(
      {
        ...meetupDraftToRow({
          kind: 'flash',
          title: '성수동 골목 야경',
          placeName: '성수역',
          district: '성동구',
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 3600e3),
          capacity: 4,
          difficulty: 'welcome',
          fee: { type: 'free' },
          genres: [],
          targetTypes: [],
          targetAges: [],
          approval: true,
          description: '설명은 열 자 이상이에요.',
        }),
        id: 'm1',
        host_id: 'h',
        status: 'open',
      },
      [
        { meetup_id: 'm1', user_id: 'a', role: 'member', status: 'confirmed', attendance: null },
        { meetup_id: 'm1', user_id: 'h', role: 'host', status: 'confirmed', attendance: null },
        { meetup_id: 'm1', user_id: 'p', role: 'member', status: 'pending', attendance: null },
        { meetup_id: 'm2', user_id: 'z', role: 'member', status: 'confirmed', attendance: null },
      ],
    );
    expect(m.participantIds).toEqual(['h', 'a']);
    expect(m.fee).toEqual({ type: 'free' });
  });

  it('실비는 앞뒤 공백을 지우고, EXIF는 앱 형식으로 돌아온다', () => {
    const row = meetupDraftToRow({ ...({} as MeetupDraft), ...baseDraft() });
    expect(row).toMatchObject({ fee_type: 'cost', fee_amount: 5000, fee_note: '장소 대여비' });
    const p = toPost({
      id: 'p1',
      author_id: 'u',
      board: 'feedback',
      topic: 'exposure',
      title: '제목',
      body: '본문',
      photo_path: 'u/a.jpg',
      exif: { camera: 'X-T5', focal_length: '56mm' },
      gear_note: null,
      like_count: 2,
      created_at: '2026-09-24T00:00:00Z',
      post_answers: [
        { id: 'b', author_id: 'v', body: '둘째', created_at: '2026-09-24T02:00:00Z' },
        { id: 'a', author_id: 'v', body: '첫째', created_at: '2026-09-24T01:00:00Z' },
      ],
    }, 'https://signed');
    expect(p.exif).toEqual({ camera: 'X-T5', focalLength: '56mm' });
    expect(p.answers.map((a) => a.id)).toEqual(['a', 'b']);
    expect(p.photoUri).toBe('https://signed');
    expect(exifFromDb(null)).toBeUndefined();
  });

  it('사진이 없는 글에는 촬영 정보를 보내지 않는다', () => {
    const row = newPostToRow({ board: 'lounge', topic: 'general', title: '제목입니다', body: '본문입니다본문', exif: { camera: 'X' }, photoWidth: 100 }, null);
    expect(row).toMatchObject({ photo_path: null, exif: null, photo_width: null });
  });

  it('서버 오류를 안내 문장으로 바꾼다', () => {
    expect(friendlyError({ code: 'P0001', hint: 'meetup_full', message: '마감된 모임이에요.' })).toBe('마감된 모임이에요.');
    expect(friendlyError({ code: '42501', message: 'new row violates row-level security policy' })).toMatch('본인인증');
    expect(friendlyError({ message: 'Invalid login credentials' })).toMatch('비밀번호');
    expect(friendlyError(new Error('Network request failed'))).toMatch('인터넷');
    expect(friendlyError(undefined)).toMatch('다시 시도');
  });
});

function baseDraft(): MeetupDraft {
  return {
    kind: 'flash',
    title: '성수동 골목 야경',
    placeName: '성수역',
    district: '성동구',
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 3600e3),
    capacity: 4,
    difficulty: 'welcome',
    fee: { type: 'cost', amount: 5000, note: ' 장소 대여비 ' },
    genres: [],
    targetTypes: [],
    targetAges: [],
    approval: true,
    description: '설명은 열 자 이상이에요.',
  };
}
