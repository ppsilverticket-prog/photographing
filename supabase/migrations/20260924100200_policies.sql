-- 포토그래핑 DB v1: 권한과 RLS 정책
-- 원칙
-- 1. 로그인하지 않은 사용자(anon)는 아무것도 볼 수 없다.
-- 2. Supabase가 기본으로 주는 테이블 권한을 모두 거두고, 필요한 열에만 다시 준다.
--    그래서 작성자·인증 상태·카운터 같은 열은 사용자가 직접 쓸 수 없다.
-- 3. 참여·출석·제재처럼 규칙이 복잡한 변경은 테이블에 직접 쓰지 않고 함수(RPC)로만 한다.
-- 4. 차단한 사이에는 서로의 모임·글·채팅·참여 기록이 보이지 않는다.
-- 새 테이블을 추가할 때도 같은 방식으로 revoke 후 필요한 권한만 준다.

-- ── 기본 권한 거두기 ─────────────────────────────────

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.profile_stats enable row level security;
alter table public.identity_verifications enable row level security;
alter table public.banned_identities enable row level security;
alter table public.meetups enable row level security;
alter table public.meetup_participants enable row level security;
alter table public.meetup_reviews enable row level security;
alter table public.chat_messages enable row level security;
alter table public.posts enable row level security;
alter table public.post_answers enable row level security;
alter table public.post_likes enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.sanctions enable row level security;

-- identity_verifications, banned_identities: 정책 없음 = 사용자 API로는 읽기·쓰기 모두 불가.
-- 서버(service role)와 security definer 함수만 쓴다.

-- ── 함수 실행 권한 ───────────────────────────────────

-- RLS 정책과 앱에서 부르는 함수
grant execute on function
  public.is_seoul_district(text),
  public.is_admin(),
  public.raise_app_error(text, text),
  public.is_verified(uuid),
  public.is_blocked_between(uuid, uuid),
  public.is_sanctioned(uuid),
  public.is_meetup_host(uuid, uuid),
  public.is_confirmed_member(uuid, uuid),
  public.is_chat_open(uuid),
  public.no_show_restriction(uuid, timestamptz),
  public.can_host(uuid),
  public.can_review(uuid, uuid, uuid),
  public.age_band_for(integer, date),
  public.join_meetup(uuid),
  public.cancel_participation(uuid),
  public.decide_join_request(uuid, uuid, boolean),
  public.mark_attendance(uuid, uuid, boolean),
  public.cancel_meetup(uuid, text),
  public.delete_my_account(),
  -- 관리자 함수. 안에서 is_admin()을 확인한다.
  public.moderate_content(public.report_target, uuid, boolean, text),
  public.apply_sanction(uuid, public.sanction_level, text, uuid),
  public.resolve_report(uuid, public.report_status, text),
  public.set_founding_host(uuid, boolean)
to authenticated;

-- 서버 전용 (본인인증 Edge Function, 연 1회 작업)
grant execute on function
  public.record_identity_verification(uuid, text, date, text),
  public.refresh_age_bands()
to service_role;

-- ── 프로필 ───────────────────────────────────────────

grant select on public.profiles to authenticated;
grant insert (display_name, activity_type, district, genres, bio) on public.profiles to authenticated;
grant update (display_name, activity_type, district, genres, bio) on public.profiles to authenticated;

create policy "profiles: 로그인한 사람은 볼 수 있음" on public.profiles
  for select to authenticated using (true);
create policy "profiles: 내 프로필 만들기" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: 내 프로필 고치기" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select on public.profile_stats to authenticated;
create policy "profile_stats: 로그인한 사람은 볼 수 있음" on public.profile_stats
  for select to authenticated using (true);

-- ── 모임 ─────────────────────────────────────────────

grant select on public.meetups to authenticated;
grant insert (
  kind, title, description, genres, place_name, district, place_lat, place_lng, kakao_place_id,
  starts_at, ends_at, capacity, difficulty, fee_type, fee_amount, fee_note,
  target_types, target_ages, requires_approval
) on public.meetups to authenticated;
-- 시간과 참가비는 사람이 모인 뒤에 바꾸면 안 되므로 수정할 수 없다 (취소 후 다시 열기)
grant update (
  title, description, genres, place_name, district, place_lat, place_lng, kakao_place_id,
  capacity, requires_approval
) on public.meetups to authenticated;

create policy "meetups: 차단한 사이가 아니면 볼 수 있음" on public.meetups
  for select to authenticated
  using (not public.is_blocked_between((select auth.uid()), host_id));
create policy "meetups: 자격이 있으면 모임 열기" on public.meetups
  for insert to authenticated
  with check (host_id = (select auth.uid()) and public.can_host((select auth.uid())));
create policy "meetups: 모임장만 고치기" on public.meetups
  for update to authenticated
  using (host_id = (select auth.uid()) and status = 'open')
  with check (host_id = (select auth.uid()));

-- 참여 기록은 읽기만 한다. 신청·취소·승인·출석은 함수로.
grant select on public.meetup_participants to authenticated;
create policy "participants: 나, 모임장, 확정 참여자 목록" on public.meetup_participants
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_meetup_host(meetup_id, (select auth.uid()))
    or (
      status = 'confirmed'
      and not public.is_blocked_between((select auth.uid()), user_id)
      -- 내가 볼 수 있는 모임의 참여자만 (meetups의 RLS가 적용된다)
      and exists (select 1 from public.meetups m where m.id = meetup_id)
    )
  );

grant select on public.meetup_reviews to authenticated;
grant insert (meetup_id, reviewee_id, score) on public.meetup_reviews to authenticated;
create policy "reviews: 내가 남긴 평가만 보기" on public.meetup_reviews
  for select to authenticated using (reviewer_id = (select auth.uid()));
create policy "reviews: 함께 있었던 사람만 평가" on public.meetup_reviews
  for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and public.can_review(meetup_id, (select auth.uid()), reviewee_id)
  );

grant select on public.chat_messages to authenticated;
grant insert (meetup_id, body) on public.chat_messages to authenticated;
create policy "chat: 확정 참여자만 읽기" on public.chat_messages
  for select to authenticated
  using (
    public.is_admin()
    or (
      status = 'visible'
      and public.is_confirmed_member(meetup_id, (select auth.uid()))
      and not public.is_blocked_between((select auth.uid()), author_id)
    )
  );
create policy "chat: 확정 참여자만 쓰기" on public.chat_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_confirmed_member(meetup_id, (select auth.uid()))
    and public.is_chat_open(meetup_id)
    and not public.is_sanctioned((select auth.uid()))
  );

-- ── 커뮤니티 ─────────────────────────────────────────

grant select, delete on public.posts to authenticated;
grant insert (
  board, topic, title, body, photo_path, photo_width, photo_height, exif, gear_note,
  has_identifiable_person, person_consent
) on public.posts to authenticated;
grant update (topic, title, body, gear_note) on public.posts to authenticated;

create policy "posts: 공개 글과 내 글 보기" on public.posts
  for select to authenticated
  using (
    (status = 'visible' and not public.is_blocked_between((select auth.uid()), author_id))
    or author_id = (select auth.uid())
    or public.is_admin()
  );
create policy "posts: 인증한 회원이 쓰기" on public.posts
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_verified((select auth.uid()))
    and not public.is_sanctioned((select auth.uid()))
  );
create policy "posts: 내 글 고치기" on public.posts
  for update to authenticated
  using (author_id = (select auth.uid()) and status = 'visible')
  with check (author_id = (select auth.uid()));
create policy "posts: 내 글 지우기" on public.posts
  for delete to authenticated using (author_id = (select auth.uid()));

grant select, delete on public.post_answers to authenticated;
grant insert (post_id, body) on public.post_answers to authenticated;
grant update (body) on public.post_answers to authenticated;

create policy "answers: 볼 수 있는 글의 공개 답변과 내 답변" on public.post_answers
  for select to authenticated
  using (
    author_id = (select auth.uid())
    or public.is_admin()
    or (
      status = 'visible'
      and not public.is_blocked_between((select auth.uid()), author_id)
      and exists (select 1 from public.posts p where p.id = post_id)
    )
  );
create policy "answers: 공개 글에 답하기" on public.post_answers
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_verified((select auth.uid()))
    and not public.is_sanctioned((select auth.uid()))
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'visible')
  );
create policy "answers: 내 답변 고치기" on public.post_answers
  for update to authenticated
  using (author_id = (select auth.uid()) and status = 'visible')
  with check (author_id = (select auth.uid()));
create policy "answers: 내 답변 지우기" on public.post_answers
  for delete to authenticated using (author_id = (select auth.uid()));

grant select, delete on public.post_likes to authenticated;
grant insert (post_id) on public.post_likes to authenticated;
create policy "likes: 내 좋아요만 보기" on public.post_likes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "likes: 볼 수 있는 글에 좋아요" on public.post_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'visible')
  );
create policy "likes: 내 좋아요 취소" on public.post_likes
  for delete to authenticated using (user_id = (select auth.uid()));

-- ── 안전 ─────────────────────────────────────────────

grant select, delete on public.blocks to authenticated;
grant insert (blocked_id) on public.blocks to authenticated;
create policy "blocks: 내 차단 목록" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "blocks: 차단하기" on public.blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "blocks: 차단 풀기" on public.blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

grant select on public.reports to authenticated;
grant insert (target_kind, target_id, reason, detail) on public.reports to authenticated;
create policy "reports: 내 신고와 처리 결과 보기" on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());
create policy "reports: 신고하기" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));

grant select on public.sanctions to authenticated;
create policy "sanctions: 내 제재 기록 보기" on public.sanctions
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
