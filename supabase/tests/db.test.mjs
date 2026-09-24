// DB 규칙 테스트. 로컬 Postgres에 Supabase 흉내(supabase_stub.sql)와 마이그레이션을 올리고,
// 실제 앱처럼 authenticated/anon/service_role 역할로 요청해서 권한과 규칙을 확인한다.
//
// 실행: DATABASE_URL=postgres://postgres@127.0.0.1:54329/postgres npm test
// (DATABASE_URL은 새 데이터베이스를 만들 수 있는 계정이어야 한다. 테스트가 끝나면 지운다.)

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';

import pg from 'pg';

const ADMIN_URL = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54329/postgres';
const DB = `photographing_test_${process.pid}`;
const HOUR = 3600e3;
const DAY = 24 * HOUR;

let admin;
let pool;

before(async () => {
  admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${DB}`);
  const url = new URL(ADMIN_URL);
  url.pathname = `/${DB}`;
  pool = new pg.Pool({ connectionString: url.toString(), max: 4 });

  const migrations = new URL('../migrations/', import.meta.url);
  const files = [
    new URL('./supabase_stub.sql', import.meta.url),
    ...readdirSync(migrations)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => new URL(f, migrations)),
  ];
  for (const file of files) await pool.query(readFileSync(file, 'utf8'));
});

after(async () => {
  await pool?.end();
  await admin?.query(`drop database if exists ${DB}`);
  await admin?.end();
});

// ── 요청 도우미 ─────────────────────────────────────

/** 테스트 준비와 결과 확인용. RLS를 무시하는 관리자 연결 */
const su = (sql, params) => pool.query(sql, params);

async function run(role, claims, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${role}`);
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** 앱에서 로그인한 사용자로 요청 */
const as = (user, fn) =>
  run('authenticated', { sub: user.id, role: 'authenticated', app_metadata: user.admin ? { role: 'admin' } : {} }, fn);
const q = (user, sql, params) => as(user, (c) => c.query(sql, params));
/** 로그인하지 않은 요청 */
const anon = (sql, params) => run('anon', { role: 'anon' }, (c) => c.query(sql, params));
/** 서버(Edge Function)에서 service role 키로 요청 */
const service = (sql, params) => run('service_role', { role: 'service_role' }, (c) => c.query(sql, params));

async function rejects(promise, pattern) {
  await assert.rejects(
    promise,
    (error) => {
      assert.match(`${error.message} | hint=${error.hint ?? ''} | code=${error.code ?? ''}`, pattern);
      return true;
    },
    `거부되어야 하는데 통과했다: ${pattern}`,
  );
}

const RLS = /row-level security|permission denied/;
const at = (ms) => new Date(Date.now() + ms).toISOString();

// ── 데이터 도우미 ───────────────────────────────────

let userSeq = 0;

async function makeUser(name, opts = {}) {
  const { verify = true, birthDate = '1994-05-01', type = 'amateur', district = '성동구', founding = false } = opts;
  userSeq += 1;
  const {
    rows: [{ id }],
  } = await su(`insert into auth.users (email) values ($1) returning id`, [`${name}${userSeq}@test.local`]);
  const user = { id, name, admin: !!opts.admin, ci: `ci-${name}-${userSeq}-${'x'.repeat(40)}` };
  await q(user, `insert into public.profiles (display_name, activity_type, district, genres) values ($1, $2, $3, '{snap}')`, [
    name,
    type,
    district,
  ]);
  if (verify) {
    await service(`select public.record_identity_verification($1, $2, $3, 'test')`, [id, user.ci, birthDate]);
  }
  if (founding) await su(`update public.profiles set is_founding_host = true where id = $1`, [id]);
  return user;
}

async function createMeetup(host, over = {}) {
  const m = {
    kind: 'flash',
    title: '성수동 골목 야경 스냅',
    description: '골목 네온을 주제로 손각대 야경을 연습해요.',
    place_name: '성수역 2번 출구',
    district: '성동구',
    starts_at: at(48 * HOUR),
    ends_at: at(51 * HOUR),
    capacity: 6,
    requires_approval: false,
    ...over,
  };
  const cols = Object.keys(m);
  const { rows } = await q(
    host,
    `insert into public.meetups (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
    Object.values(m),
  );
  return rows[0];
}

/** 이미 지난 모임 (서버 권한으로 만든다) */
async function pastMeetup(host, daysAgo, over = {}) {
  const start = new Date(Date.now() - daysAgo * DAY);
  const { rows } = await su(
    `insert into public.meetups (host_id, title, description, place_name, district, starts_at, ends_at, capacity, requires_approval)
     values ($1, $2, '지난 모임 테스트용 설명입니다.', '성수역', '성동구', $3, $4, 10, false) returning *`,
    [host.id, over.title ?? `지난 모임 ${daysAgo}일 전`, start.toISOString(), new Date(start.getTime() + 2 * HOUR).toISOString()],
  );
  return rows[0];
}

async function addConfirmed(meetup, user, attendance = null) {
  await su(`insert into public.meetup_participants (meetup_id, user_id, status, attendance) values ($1, $2, 'confirmed', $3)`, [
    meetup.id,
    user.id,
    attendance,
  ]);
}

const stats = async (user) => (await su(`select * from public.profile_stats where user_id = $1`, [user.id])).rows[0];
const join = (user, meetup) => q(user, `select public.join_meetup($1) as s`, [meetup.id]).then((r) => r.rows[0].s);

// ── 테스트 ──────────────────────────────────────────

describe('가입과 본인인증', () => {
  it('로그인하지 않은 요청은 아무것도 읽을 수 없다', async () => {
    for (const table of ['profiles', 'meetups', 'posts', 'chat_messages', 'meetup_participants']) {
      await rejects(anon(`select * from public.${table} limit 1`), /permission denied/);
    }
    await rejects(anon(`select public.join_meetup(gen_random_uuid())`), /permission denied/);
  });

  it('프로필은 내 것만 만들고, 인증 상태·창립 모임장은 직접 정할 수 없다', async () => {
    const other = await makeUser('other');
    const { rows } = await su(`insert into auth.users (email) values ('x@test.local') returning id`);
    const me = { id: rows[0].id };

    // 다른 사람 id로 만들기, 인증 상태 직접 넣기 → 열 권한이 없다
    await rejects(
      q(me, `insert into public.profiles (id, display_name, activity_type, district) values ($1, '가짜', 'amateur', '중구')`, [other.id]),
      /permission denied/,
    );
    await rejects(
      q(me, `insert into public.profiles (display_name, activity_type, district, verified_at) values ('가짜', 'amateur', '중구', now())`),
      /permission denied/,
    );

    await q(me, `insert into public.profiles (display_name, activity_type, district) values ('새사람', 'beginner', '중구')`);
    const mine = (await su(`select * from public.profiles where id = $1`, [me.id])).rows[0];
    assert.equal(mine.verified_at, null);
    assert.equal(mine.is_founding_host, false);

    await rejects(q(me, `update public.profiles set is_founding_host = true where id = $1`, [me.id]), /permission denied/);
    const r = await q(me, `update public.profiles set display_name = '바꿈' where id = $1`, [other.id]);
    assert.equal(r.rowCount, 0, '다른 사람 프로필은 고칠 수 없다');
    await rejects(
      q(me, `insert into public.profiles (display_name, activity_type, district) values ('또', 'beginner', '수원시')`),
      /check constraint|duplicate key/,
    );
  });

  it('본인인증 기록은 서버만 하고, 만 19세 미만·중복·정지된 정보를 막는다', async () => {
    const user = await makeUser('verify', { verify: false });
    await rejects(
      q(user, `select public.record_identity_verification($1, $2, '1990-01-01', 'test')`, [user.id, user.ci]),
      /permission denied/,
    );

    const today = new Date();
    const underage = `${today.getUTCFullYear() - 18}-01-01`;
    await rejects(service(`select public.record_identity_verification($1, $2, $3, 'test')`, [user.id, user.ci, underage]), /hint=underage/);

    const band = await service(`select public.record_identity_verification($1, $2, '2001-03-01', 'test') as b`, [user.id, user.ci]);
    assert.equal(band.rows[0].b, '20s');
    const p = (await su(`select verified_at, age_band from public.profiles where id = $1`, [user.id])).rows[0];
    assert.ok(p.verified_at);
    assert.equal(p.age_band, '20s');

    const second = await makeUser('second', { verify: false });
    await rejects(
      service(`select public.record_identity_verification($1, $2, '1990-01-01', 'test')`, [second.id, user.ci]),
      /hint=already_registered/,
    );

    await rejects(q(user, `select * from public.identity_verifications`), /permission denied/);
    await rejects(q(user, `select * from public.banned_identities`), /permission denied/);
  });

  it('인증을 먼저 하고 프로필을 나중에 만들어도 인증 결과가 이어진다', async () => {
    const { rows } = await su(`insert into auth.users (email) values ('first@test.local') returning id`);
    const user = { id: rows[0].id };
    await service(`select public.record_identity_verification($1, $2, '1985-07-07', 'test')`, [user.id, `ci-first-${'y'.repeat(40)}`]);
    await q(user, `insert into public.profiles (display_name, activity_type, district) values ('먼저인증', 'amateur', '마포구')`);
    const p = (await su(`select verified_at, age_band from public.profiles where id = $1`, [user.id])).rows[0];
    assert.ok(p.verified_at);
    assert.equal(p.age_band, '40s');
  });
});

describe('모임 만들기', () => {
  it('참석 기록이 없는 새 회원은 모임을 열 수 없고, 창립 모임장은 열 수 있다', async () => {
    const newbie = await makeUser('newbie');
    await rejects(createMeetup(newbie), RLS);

    const host = await makeUser('host', { founding: true });
    const m = await createMeetup(host);
    assert.equal(m.host_id, host.id);
    assert.equal(m.status, 'open');

    const hostRow = (await su(`select * from public.meetup_participants where meetup_id = $1`, [m.id])).rows;
    assert.deepEqual(
      hostRow.map((r) => [r.user_id, r.role, r.status]),
      [[host.id, 'host', 'confirmed']],
    );
    assert.equal((await stats(host)).hosted, 1);
  });

  it('다른 모임에 한 번 참석하면 모임을 열 수 있다', async () => {
    const host = await makeUser('host2', { founding: true });
    const member = await makeUser('member2');
    await rejects(createMeetup(member), RLS);
    await addConfirmed(await pastMeetup(host, 3), member, 'attended');
    const m = await createMeetup(member);
    assert.equal(m.host_id, member.id);
  });

  it('입력 규칙: 모델 촬영회, 1시간 이내 시작, 실비 용도, 서울 밖, 모임장 바꾸기', async () => {
    const host = await makeUser('rules', { founding: true });
    await rejects(createMeetup(host, { description: '전문 모델 섭외해서 인물 촬영회를 합니다.' }), /meetups_no_model_shoot/);
    await rejects(createMeetup(host, { starts_at: at(0.5 * HOUR), ends_at: at(2 * HOUR) }), /hint=starts_too_soon/);
    await rejects(createMeetup(host, { fee_type: 'cost', fee_amount: 5000 }), /meetups_fee/);
    await rejects(createMeetup(host, { fee_type: 'cost', fee_note: '장소 대여비' }), /meetups_fee/);
    await rejects(createMeetup(host, { place_lat: 37.54 }), /meetups_place_coords/);
    await rejects(createMeetup(host, { place_lat: 35.1, place_lng: 129.0 }), /meetups_place_coords/);
    await rejects(createMeetup(host, { district: '수원시' }), /check constraint/);
    await rejects(createMeetup(host, { ends_at: at(62 * HOUR) }), /meetups_max_duration/);

    const other = await makeUser('other2', { founding: true });
    await rejects(
      q(host, `insert into public.meetups (host_id, title, description, place_name, district, starts_at, ends_at, capacity)
               values ($1, '남의 이름으로 모임', '다른 사람을 모임장으로 넣어 봅니다.', '성수역', '성동구', $2, $3, 4)`, [
        other.id,
        at(48 * HOUR),
        at(50 * HOUR),
      ]),
      /permission denied/,
    );

    const m = await createMeetup(host, { fee_type: 'cost', fee_amount: 5000, fee_note: '장소 대여비' });
    await rejects(q(host, `update public.meetups set starts_at = now() + interval '3 days' where id = $1`, [m.id]), /permission denied/);
    const ok = await q(host, `update public.meetups set title = '제목을 바꿨어요' where id = $1`, [m.id]);
    assert.equal(ok.rowCount, 1);
    const notMine = await q(other, `update public.meetups set title = '남의 모임 수정' where id = $1`, [m.id]);
    assert.equal(notMine.rowCount, 0);
  });
});

describe('참여 신청과 취소', () => {
  it('참여 기록은 직접 쓸 수 없고 함수로만 신청한다', async () => {
    const host = await makeUser('jh', { founding: true });
    const user = await makeUser('ju');
    const m = await createMeetup(host);
    await rejects(
      q(user, `insert into public.meetup_participants (meetup_id, user_id, status) values ($1, $2, 'confirmed')`, [m.id, user.id]),
      /permission denied/,
    );
    assert.equal(await join(user, m), 'confirmed');
    assert.equal(await join(user, m), 'confirmed', '두 번 신청해도 같은 결과');
    await rejects(join(host, m), /hint=own_meetup/);
  });

  it('승인제: 대기 → 모임장 승인. 대기 중인 신청은 다른 참여자에게 보이지 않는다', async () => {
    const host = await makeUser('ah', { founding: true });
    const a = await makeUser('aa');
    const b = await makeUser('ab');
    const m = await createMeetup(host, { requires_approval: true });

    assert.equal(await join(a, m), 'pending');
    assert.equal(await join(b, m), 'pending');
    const seenByB = await q(b, `select user_id from public.meetup_participants where meetup_id = $1`, [m.id]);
    assert.deepEqual(seenByB.rows.map((r) => r.user_id).sort(), [b.id, host.id].sort(), 'b는 자기 신청과 확정된 모임장만 본다');
    const seenByHost = await q(host, `select user_id from public.meetup_participants where meetup_id = $1`, [m.id]);
    assert.equal(seenByHost.rowCount, 3);

    await rejects(q(a, `select public.decide_join_request($1, $2, true)`, [m.id, b.id]), /hint=not_host/);
    const decided = await q(host, `select public.decide_join_request($1, $2, true) as s`, [m.id, a.id]);
    assert.equal(decided.rows[0].s, 'confirmed');
    await q(host, `select public.decide_join_request($1, $2, false)`, [m.id, b.id]);
    await rejects(join(b, m), /hint=declined/);
  });

  it('정원, 대상 유형, 대상 연령대, 본인인증을 확인한다', async () => {
    const host = await makeUser('ch', { founding: true });
    const small = await createMeetup(host, { capacity: 2 });
    await join(await makeUser('c1'), small);
    await rejects(join(await makeUser('c2'), small), /hint=meetup_full/);

    const beginnersOnly = await createMeetup(host, { target_types: ['beginner'] });
    await rejects(join(await makeUser('amateur1'), beginnersOnly), /hint=not_target_type/);
    assert.equal(await join(await makeUser('beginner1', { type: 'beginner' }), beginnersOnly), 'confirmed');

    const twenties = await createMeetup(host, { target_ages: ['20s'] });
    await rejects(join(await makeUser('thirty', { birthDate: '1993-02-02' }), twenties), /hint=not_target_age/);
    assert.equal(await join(await makeUser('twenty', { birthDate: '2002-02-02' }), twenties), 'confirmed');

    await rejects(join(await makeUser('noverify', { verify: false }), small), /hint=not_verified/);
  });

  it('차단한 사이에는 모임이 보이지 않고 신청할 수 없다', async () => {
    const host = await makeUser('bh', { founding: true });
    const user = await makeUser('bu');
    const m = await createMeetup(host);
    await q(host, `insert into public.blocks (blocked_id) values ($1)`, [user.id]);

    const seen = await q(user, `select id from public.meetups where id = $1`, [m.id]);
    assert.equal(seen.rowCount, 0, '차단당한 쪽도 모임장이 연 모임을 볼 수 없다');
    await rejects(join(user, m), /hint=meetup_not_found/);

    const blocks = await q(user, `select * from public.blocks`);
    assert.equal(blocks.rowCount, 0, '누가 나를 차단했는지는 알 수 없다');
  });

  it('시작 24시간 이내 취소는 늦은 취소로 남고, 그 전 취소는 남지 않는다', async () => {
    const host = await makeUser('lh', { founding: true });
    const user = await makeUser('lu');
    const soon = await createMeetup(host, { starts_at: at(5 * HOUR), ends_at: at(7 * HOUR) });
    const later = await createMeetup(host);

    await join(user, later);
    const early = await q(user, `select public.cancel_participation($1) as late`, [later.id]);
    assert.equal(early.rows[0].late, false);
    assert.equal((await stats(user)).late_cancels, 0);

    await join(user, soon);
    const late = await q(user, `select public.cancel_participation($1) as late`, [soon.id]);
    assert.equal(late.rows[0].late, true);
    assert.equal((await stats(user)).late_cancels, 1);

    // 다시 신청해도 늦은 취소 기록은 남는다
    await join(user, soon);
    assert.equal((await stats(user)).late_cancels, 1);

    await rejects(q(host, `select public.cancel_participation($1)`, [soon.id]), /hint=host_cannot_leave/);
  });

  it('모임장이 모임을 취소하면 새 신청을 받지 않는다', async () => {
    const host = await makeUser('xh', { founding: true });
    const m = await createMeetup(host);
    await rejects(q(await makeUser('xo'), `select public.cancel_meetup($1)`, [m.id]), /hint=not_host/);
    await q(host, `select public.cancel_meetup($1, '비 예보')`, [m.id]);
    await rejects(join(await makeUser('xu'), m), /hint=meetup_canceled/);
    const s = await stats(host);
    assert.equal(s.hosted, 0);
    assert.equal(s.hosted_canceled, 1);
  });
});

describe('출석과 노쇼 제한 (운영정책 4-2절, 앱 noShow.ts와 같은 규칙)', () => {
  it('출석은 모임장만, 모임이 시작한 뒤에 체크한다', async () => {
    const host = await makeUser('ph', { founding: true });
    const user = await makeUser('pu');
    const past = await pastMeetup(host, 1);
    await addConfirmed(past, user);

    await rejects(q(user, `select public.mark_attendance($1, $2, true)`, [past.id, user.id]), /hint=not_host/);
    await q(host, `select public.mark_attendance($1, $2, false)`, [past.id, user.id]);
    assert.equal((await stats(user)).no_shows, 1);
    await q(host, `select public.mark_attendance($1, $2, true)`, [past.id, user.id]);
    const s = await stats(user);
    assert.equal(s.no_shows, 0);
    assert.equal(s.attended, 1);

    const future = await createMeetup(host);
    await join(user, future);
    await rejects(q(host, `select public.mark_attendance($1, $2, true)`, [future.id, user.id]), /hint=not_started/);
  });

  it('90일 안 노쇼 2회: 마지막 노쇼부터 14일 동안 신청할 수 없다', async () => {
    const host = await makeUser('nh', { founding: true });
    const user = await makeUser('nu');
    await addConfirmed(await pastMeetup(host, 20), user, 'no_show');
    const latest = await pastMeetup(host, 3);
    await addConfirmed(latest, user, 'no_show');

    const r = (await q(user, `select * from public.no_show_restriction($1)`, [user.id])).rows[0];
    assert.equal(r.kind, 'blocked');
    assert.equal(r.no_show_count, 2);
    assert.equal(new Date(r.blocked_until).getTime(), new Date(latest.starts_at).getTime() + 14 * DAY);
    await rejects(join(user, await createMeetup(host)), /hint=no_show_blocked/);
  });

  it('3회 이상은 30일 뒤 승인제 모임만, 90일이 지난 노쇼는 세지 않는다', async () => {
    const host = await makeUser('oh', { founding: true });
    const user = await makeUser('ou');
    for (const days of [80, 70, 35]) await addConfirmed(await pastMeetup(host, days), user, 'no_show');

    const r = (await q(user, `select * from public.no_show_restriction($1)`, [user.id])).rows[0];
    assert.equal(r.kind, 'approval_only');
    await rejects(join(user, await createMeetup(host)), /hint=approval_only/);
    assert.equal(await join(user, await createMeetup(host, { requires_approval: true })), 'pending');

    const old = await makeUser('old');
    for (const days of [120, 100]) await addConfirmed(await pastMeetup(host, days), old, 'no_show');
    assert.equal((await q(old, `select kind from public.no_show_restriction($1)`, [old.id])).rows[0].kind, 'none');
  });
});

describe('매너 평가와 신뢰도', () => {
  it('함께 있었던 사람만 끝난 뒤 7일 안에 평가하고, 받은 개별 점수는 볼 수 없다', async () => {
    const host = await makeUser('rh', { founding: true });
    const a = await makeUser('ra');
    const noShow = await makeUser('rn');
    const stranger = await makeUser('rs');
    const m = await pastMeetup(host, 1);
    await addConfirmed(m, a, 'attended');
    await addConfirmed(m, noShow, 'no_show');

    const review = (u, reviewee, score) =>
      q(u, `insert into public.meetup_reviews (meetup_id, reviewee_id, score) values ($1, $2, $3)`, [m.id, reviewee.id, score]);

    await review(a, host, 5);
    await review(host, a, 4);
    await rejects(review(a, noShow, 1), RLS);
    await rejects(review(noShow, host, 1), RLS);
    await rejects(review(stranger, host, 1), RLS);
    await rejects(review(a, a, 5), RLS);
    await rejects(
      q(a, `insert into public.meetup_reviews (meetup_id, reviewer_id, reviewee_id, score) values ($1, $2, $3, 5)`, [m.id, host.id, a.id]),
      /permission denied/,
    );

    const received = await q(host, `select * from public.meetup_reviews where reviewee_id = $1`, [host.id]);
    assert.equal(received.rowCount, 0);
    assert.equal(Number((await stats(host)).manner_avg), 5);
    assert.equal(Number((await stats(a)).manner_avg), 4);

    const old = await pastMeetup(host, 9);
    await addConfirmed(old, a, 'attended');
    await rejects(
      q(a, `insert into public.meetup_reviews (meetup_id, reviewee_id, score) values ($1, $2, 5)`, [old.id, host.id]),
      RLS,
    );
  });
});

describe('모임 채팅', () => {
  it('확정 참여자만 읽고 쓰며, 차단한 사람의 메시지는 보이지 않는다', async () => {
    const host = await makeUser('th', { founding: true });
    const a = await makeUser('ta');
    const pending = await makeUser('tp');
    const outsider = await makeUser('to');
    const m = await createMeetup(host, { requires_approval: true });
    await join(a, m);
    await q(host, `select public.decide_join_request($1, $2, true)`, [m.id, a.id]);
    await join(pending, m);

    const say = (u, body) => q(u, `insert into public.chat_messages (meetup_id, body) values ($1, $2)`, [m.id, body]);
    await say(host, '토요일에 봬요');
    await say(a, '네 좋아요');
    await rejects(say(pending, '저도요'), RLS);
    await rejects(say(outsider, '안녕하세요'), RLS);

    const read = (u) => q(u, `select body from public.chat_messages where meetup_id = $1 order by created_at`, [m.id]);
    assert.equal((await read(a)).rowCount, 2);
    assert.equal((await read(pending)).rowCount, 0);
    assert.equal((await read(outsider)).rowCount, 0);

    await q(a, `insert into public.blocks (blocked_id) values ($1)`, [host.id]);
    assert.deepEqual((await read(a)).rows.map((r) => r.body), ['네 좋아요']);
    assert.deepEqual((await read(host)).rows.map((r) => r.body), ['토요일에 봬요'], '차단당한 쪽에서도 서로 안 보인다');

    await q(host, `select public.cancel_meetup($1)`, [m.id]);
    await rejects(say(host, '취소됐어요'), RLS);
  });
});

describe('커뮤니티', () => {
  const post = (u, over = {}) => {
    const p = {
      board: 'feedback',
      topic: 'exposure',
      title: '야경 노출 봐주세요',
      body: '삼각대 없이 찍었는데 너무 어두운가요?',
      photo_path: `${u.id}/night.jpg`,
      exif: { camera: 'SONY ILCE-7M4', aperture: 'f/1.8', iso: 'ISO 1600' },
      ...over,
    };
    const cols = Object.keys(p);
    return q(
      u,
      `insert into public.posts (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
      Object.values(p).map((v) => (v && typeof v === 'object' ? JSON.stringify(v) : v)),
    ).then((r) => r.rows[0]);
  };

  it('사진·EXIF·초상권 규칙을 DB에서도 확인한다', async () => {
    const u = await makeUser('wu');
    const other = await makeUser('wo');
    await rejects(post(u, { photo_path: null }), /posts_feedback_needs_photo/);
    await rejects(post(u, { photo_path: `${other.id}/stolen.jpg` }), /posts_photo_in_own_folder/);
    await rejects(post(u, { exif: { camera: 'X-T5', gps_latitude: 37.5 } }), /posts_exif_whitelist/);
    await rejects(post(u, { has_identifiable_person: true }), /posts_person_consent/);
    const ok = await post(u, { has_identifiable_person: true, person_consent: true });
    assert.equal(ok.author_id, u.id);
    await rejects(post(await makeUser('wv', { verify: false }), {}), RLS);
    await rejects(post(u, { status: 'hidden' }), /permission denied/);
  });

  it('답변과 좋아요 수는 DB가 센다', async () => {
    const u = await makeUser('cu');
    const v = await makeUser('cv');
    const p = await post(u);
    await q(v, `insert into public.post_answers (post_id, body) values ($1, '하늘 노출을 한 스톱 올려 보세요.')`, [p.id]);
    await q(v, `insert into public.post_likes (post_id) values ($1)`, [p.id]);
    let row = (await su(`select answer_count, like_count from public.posts where id = $1`, [p.id])).rows[0];
    assert.deepEqual(row, { answer_count: 1, like_count: 1 });

    await rejects(q(u, `update public.posts set like_count = 999 where id = $1`, [p.id]), /permission denied/);
    await q(v, `delete from public.post_likes where post_id = $1`, [p.id]);
    row = (await su(`select like_count from public.posts where id = $1`, [p.id])).rows[0];
    assert.equal(row.like_count, 0);
  });

  it('차단하면 서로의 글이 보이지 않고, 제재 중에는 글을 쓸 수 없다', async () => {
    const a = await makeUser('ka');
    const b = await makeUser('kb');
    const pa = await post(a);
    const pb = await post(b);
    await q(a, `insert into public.blocks (blocked_id) values ($1)`, [b.id]);
    assert.equal((await q(a, `select id from public.posts where id = $1`, [pb.id])).rowCount, 0);
    assert.equal((await q(b, `select id from public.posts where id = $1`, [pa.id])).rowCount, 0);
    await rejects(q(b, `insert into public.post_answers (post_id, body) values ($1, '차단당해도 답할 수 있나요?')`, [pa.id]), RLS);

    const adminUser = await makeUser('adm', { admin: true });
    await q(adminUser, `select public.apply_sanction($1, 'restricted_7d', '괴롭힘')`, [b.id]);
    await rejects(post(b), RLS);
    await rejects(join(b, await createMeetup(await makeUser('kh', { founding: true }))), /hint=sanctioned/);
    await rejects(
      su(
        `insert into public.sanctions (user_id, level, reason, starts_at, ends_at)
         values ($1, 'restricted_7d', '끝이 시작보다 앞', now(), now() - interval '1 day')`,
        [b.id],
      ),
      /sanctions_period/,
    );
    const mine = await q(b, `select level from public.sanctions`);
    assert.deepEqual(mine.rows.map((r) => r.level), ['restricted_7d']);
  });
});

describe('신고와 관리자', () => {
  it('불법 촬영 신고는 즉시 가리고, 신고 내용은 신고자와 관리자만 본다', async () => {
    const author = await makeUser('ea');
    const reporter = await makeUser('er');
    const viewer = await makeUser('ev');
    const adminUser = await makeUser('ead', { admin: true });
    const { rows } = await q(
      author,
      `insert into public.posts (board, title, body, photo_path) values ('feedback', '거리 인물 사진', '지나가는 사람을 찍었어요. 어떤가요?', $1) returning id`,
      [`${author.id}/street.jpg`],
    );
    const postId = rows[0].id;

    const report = await q(
      reporter,
      `insert into public.reports (target_kind, target_id, reason) values ('post', $1, 'illegal_filming') returning id, priority`,
      [postId],
    );
    assert.equal(report.rows[0].priority, 'urgent');
    assert.equal((await q(viewer, `select id from public.posts where id = $1`, [postId])).rowCount, 0, '다른 사람에게 가려진다');
    assert.equal((await q(author, `select status from public.posts where id = $1`, [postId])).rows[0].status, 'hidden');
    await rejects(q(author, `update public.posts set status = 'visible' where id = $1`, [postId]), /permission denied/);

    assert.equal((await q(viewer, `select * from public.reports`)).rowCount, 0);
    assert.equal((await q(reporter, `select * from public.reports`)).rowCount, 1);
    await rejects(q(reporter, `select public.moderate_content('post', $1, true)`, [postId]), /hint=not_admin/);

    assert.ok((await q(adminUser, `select * from public.reports where id = $1`, [report.rows[0].id])).rowCount === 1);
    await q(adminUser, `select public.moderate_content('post', $1, true)`, [postId]);
    await q(adminUser, `select public.resolve_report($1, 'dismissed', '동의받은 사진으로 확인')`, [report.rows[0].id]);
    assert.equal((await q(viewer, `select id from public.posts where id = $1`, [postId])).rowCount, 1);
  });

  it('영구 정지하면 같은 본인인증 정보로 다시 가입할 수 없다', async () => {
    const bad = await makeUser('bad');
    const adminUser = await makeUser('bad-admin', { admin: true });
    await rejects(q(bad, `select public.apply_sanction($1, 'permanent', '스스로')`, [bad.id]), /hint=not_admin/);
    await q(adminUser, `select public.apply_sanction($1, 'permanent', '불법 촬영')`, [bad.id]);

    await su(`delete from auth.users where id = $1`, [bad.id]);
    const again = await makeUser('bad-again', { verify: false });
    await rejects(
      service(`select public.record_identity_verification($1, $2, '1994-05-01', 'test')`, [again.id, bad.ci]),
      /hint=banned/,
    );
  });
});

describe('사진 저장소', () => {
  it('내 폴더에만 올릴 수 있다', async () => {
    const u = await makeUser('su');
    const other = await makeUser('so');
    await q(u, `insert into storage.objects (bucket_id, name) values ('post-photos', $1)`, [`${u.id}/a.jpg`]);
    await rejects(q(u, `insert into storage.objects (bucket_id, name) values ('post-photos', $1)`, [`${other.id}/a.jpg`]), RLS);
    const bucket = (await su(`select public, allowed_mime_types from storage.buckets where id = 'post-photos'`)).rows[0];
    assert.deepEqual(bucket, { public: false, allowed_mime_types: ['image/jpeg'] });
  });
});

describe('보안 점검', () => {
  it('security definer 함수는 모두 search_path를 비워 둔다', async () => {
    const r = await su(`
      select p.proname
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.prosecdef
        and not coalesce('search_path=""' = any (p.proconfig), false)`);
    assert.deepEqual(r.rows, []);
  });

  it('로그인하지 않은 역할(anon)은 public 함수를 하나도 실행할 수 없다', async () => {
    const r = await su(`
      select p.proname
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and has_function_privilege('anon', p.oid, 'execute')`);
    assert.deepEqual(r.rows, []);
  });

  it('서버 전용 함수는 로그인한 사용자도 실행할 수 없다', async () => {
    for (const fn of ['record_identity_verification(uuid, text, date, text)', 'refresh_age_bands()', 'refresh_profile_stats(uuid)']) {
      const r = await su(`select has_function_privilege('authenticated', 'public.${fn}', 'execute') as ok`);
      assert.equal(r.rows[0].ok, false, fn);
    }
  });
});

describe('계정 삭제와 실시간', () => {
  it('계정을 지우면 프로필·참여·글이 사라지고, 내가 한 신고는 기록으로 남는다', async () => {
    const host = await makeUser('dh', { founding: true });
    const u = await makeUser('du');
    await join(u, await createMeetup(host));
    await q(u, `insert into public.posts (board, title, body) values ('lounge', '지울 글입니다', '계정을 지우면 사라져야 하는 글')`);
    await q(u, `insert into public.reports (target_kind, target_id, reason) values ('member', $1, 'spam')`, [host.id]);

    await q(u, `select public.delete_my_account()`);
    for (const [table, col] of [
      ['auth.users', 'id'],
      ['public.profiles', 'id'],
      ['public.meetup_participants', 'user_id'],
      ['public.posts', 'author_id'],
    ]) {
      assert.equal((await su(`select 1 from ${table} where ${col} = $1`, [u.id])).rowCount, 0, `${table}에 남으면 안 된다`);
    }
    const report = (await su(`select reporter_id from public.reports where target_id = $1`, [host.id])).rows[0];
    assert.equal(report.reporter_id, null);
  });

  it('모임 채팅은 실시간 발행에 들어 있다', async () => {
    const r = await su(`select tablename from pg_publication_tables where pubname = 'supabase_realtime'`);
    assert.deepEqual(r.rows.map((x) => x.tablename), ['chat_messages']);
  });
});
