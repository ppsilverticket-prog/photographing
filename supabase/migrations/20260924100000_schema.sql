-- 포토그래핑 DB 스키마 v1: 타입과 테이블
-- 설명: docs/08-database.md · 규칙의 근거: docs/07-operations-policy.md
-- 이 파일은 구조만 만든다. 함수·트리거는 다음 파일, 권한(RLS)은 그다음 파일에 있다.

-- ── 타입 ─────────────────────────────────────────────

create type public.activity_type as enum ('beginner', 'amateur', 'student', 'pro');
create type public.age_band as enum ('20s', '30s', '40s', '50plus');
create type public.genre as enum ('landscape', 'portrait', 'snap', 'film', 'street', 'night');
create type public.difficulty as enum ('welcome', 'intermediate', 'advanced');
create type public.meetup_kind as enum ('flash', 'crew');
create type public.meetup_status as enum ('open', 'canceled');
create type public.fee_type as enum ('free', 'cost');
create type public.participant_role as enum ('host', 'member');
create type public.participant_status as enum ('pending', 'confirmed', 'declined', 'canceled');
create type public.attendance as enum ('attended', 'no_show');
create type public.board as enum ('feedback', 'lounge', 'qna');
create type public.feedback_topic as enum ('exposure', 'retouch', 'film', 'gear', 'general');
create type public.content_status as enum ('visible', 'hidden');
create type public.report_target as enum ('meetup', 'member', 'post', 'answer', 'chat_message');
create type public.report_reason as enum (
  'emergency', 'illegal_filming', 'portrait_rights', 'harassment', 'defamation',
  'copyright', 'spam', 'no_show', 'other'
);
create type public.report_status as enum ('received', 'reviewing', 'actioned', 'dismissed');
create type public.sanction_level as enum ('warning', 'restricted_7d', 'restricted_30d', 'permanent');

-- 초기에는 서울만 운영한다 (플랜 8절)
create function public.is_seoul_district(d text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select d = any (array[
    '종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구',
    '도봉구', '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구', '구로구', '금천구',
    '영등포구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구'
  ]);
$$;

-- ── 회원 ─────────────────────────────────────────────

-- 공개 프로필. 다른 회원에게 보이는 정보만 둔다.
-- age_band와 verified_at은 본인인증 결과로만 정해지고 사용자가 직접 바꿀 수 없다 (권한 파일 참고).
create table public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 12),
  activity_type public.activity_type not null,
  age_band public.age_band,
  district text not null check (public.is_seoul_district(district)),
  genres public.genre[] not null default '{}',
  bio text check (bio is null or char_length(bio) <= 300),
  is_founding_host boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 신뢰도 숫자. 원본(참여·후기·모임)이 바뀔 때 트리거가 다시 계산한다.
create table public.profile_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  attended integer not null default 0,
  no_shows integer not null default 0,
  late_cancels integer not null default 0,
  hosted integer not null default 0,
  hosted_canceled integer not null default 0,
  manner_sum integer not null default 0,
  manner_count integer not null default 0,
  manner_avg numeric(3, 2) generated always as (
    case when manner_count > 0 then round(manner_sum::numeric / manner_count, 2) end
  ) stored,
  updated_at timestamptz not null default now()
);

-- 본인인증 결과 (비공개). 누구도 API로 읽을 수 없고 서버 함수만 쓴다.
-- 주민등록번호와 생년월일 전체는 저장하지 않는다. CI는 해시로만, 나이는 출생 연도로만 둔다.
create table public.identity_verifications (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ci_hash text not null unique check (char_length(ci_hash) between 32 and 128),
  birth_year smallint not null check (birth_year between 1900 and 2100),
  provider text not null,
  verified_at timestamptz not null default now()
);

-- 영구 정지된 사람의 재가입을 막는다. 계정을 지워도 남는다 (보관 기간은 docs/07 8절 5번 확인 필요).
create table public.banned_identities (
  ci_hash text primary key,
  reason text not null,
  banned_at timestamptz not null default now()
);

-- ── 모임 ─────────────────────────────────────────────

create table public.meetups (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind public.meetup_kind not null default 'flash',
  title text not null check (char_length(btrim(title)) between 4 and 40),
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  genres public.genre[] not null default '{}',
  place_name text not null check (char_length(btrim(place_name)) between 2 and 100),
  district text not null check (public.is_seoul_district(district)),
  -- 모임 장소의 좌표 (지도 표시용). 사용자 기기 위치가 아니다 (운영정책 D1).
  place_lat double precision,
  place_lng double precision,
  kakao_place_id text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity between 2 and 30),
  difficulty public.difficulty not null default 'welcome',
  fee_type public.fee_type not null default 'free',
  fee_amount integer,
  fee_note text,
  target_types public.activity_type[] not null default '{}',
  target_ages public.age_band[] not null default '{}',
  requires_approval boolean not null default true,
  status public.meetup_status not null default 'open',
  canceled_at timestamptz,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint meetups_time_order check (ends_at > starts_at),
  constraint meetups_max_duration check (ends_at - starts_at <= interval '12 hours'),
  -- CHECK는 결과가 NULL이면 통과시키므로 NULL일 수 있는 값은 is not null을 먼저 확인한다
  constraint meetups_fee check (
    (fee_type = 'free' and fee_amount is null and fee_note is null)
    or (fee_type = 'cost'
        and fee_amount is not null and fee_amount between 1 and 50000
        and fee_note is not null and char_length(btrim(fee_note)) between 1 and 100)
  ),
  constraint meetups_place_coords check (
    (place_lat is null and place_lng is null)
    or (place_lat is not null and place_lng is not null
        and place_lat between 37.40 and 37.72 and place_lng between 126.76 and 127.19)
  ),
  -- 모델을 섭외하는 인물 촬영회는 MVP에서 열 수 없다 (운영정책 4-1절). 앱의 검사와 같은 패턴.
  constraint meetups_no_model_shoot check (
    (title || ' ' || description) !~ '(모델\s*섭외|촬영회|모델\s*출사|피팅\s*모델)'
  ),
  constraint meetups_canceled check ((status = 'canceled') = (canceled_at is not null))
);

create index meetups_upcoming_idx on public.meetups (starts_at) where status = 'open';
create index meetups_district_idx on public.meetups (district, starts_at) where status = 'open';
create index meetups_host_idx on public.meetups (host_id);

-- 참여 신청과 출석. 모임장도 role = 'host'로 한 줄 가진다.
-- 사용자는 이 테이블에 직접 쓰지 못하고 join_meetup 같은 함수로만 바꾼다.
create table public.meetup_participants (
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.participant_role not null default 'member',
  status public.participant_status not null,
  -- 시작 24시간 이내에 취소한 적이 있으면 true. 다시 신청해도 기록은 남는다.
  late_cancel boolean not null default false,
  attendance public.attendance,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  canceled_at timestamptz,
  attendance_marked_at timestamptz,
  primary key (meetup_id, user_id),
  constraint participants_host_confirmed check (role = 'member' or (status = 'confirmed' and attendance is null)),
  constraint participants_attendance_confirmed check (attendance is null or status = 'confirmed')
);

create index meetup_participants_user_idx on public.meetup_participants (user_id);
create unique index meetup_participants_one_host on public.meetup_participants (meetup_id) where role = 'host';

-- 매너 평가. 개별 점수는 받은 사람에게 보이지 않고 평균만 공개한다.
create table public.meetup_reviews (
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  reviewer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (meetup_id, reviewer_id, reviewee_id),
  constraint reviews_not_self check (reviewer_id <> reviewee_id)
);

create index meetup_reviews_reviewee_idx on public.meetup_reviews (reviewee_id);

-- 모임 채팅. 참여가 확정된 사람만 읽고 쓴다.
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  status public.content_status not null default 'visible',
  created_at timestamptz not null default now()
);

create index chat_messages_meetup_idx on public.chat_messages (meetup_id, created_at);

-- ── 커뮤니티 ─────────────────────────────────────────

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  board public.board not null,
  topic public.feedback_topic not null default 'general',
  title text not null check (char_length(btrim(title)) between 4 and 50),
  body text not null check (char_length(btrim(body)) between 10 and 5000),
  -- 스토리지 경로: post-photos 버킷의 "{작성자 id}/파일명"
  photo_path text,
  photo_width integer check (photo_width is null or photo_width between 1 and 4096),
  photo_height integer check (photo_height is null or photo_height between 1 and 4096),
  -- 보여 줄 촬영 정보만. 위치(GPS) 같은 다른 키는 저장할 수 없다 (운영정책 D2).
  exif jsonb,
  gear_note text check (gear_note is null or char_length(gear_note) <= 100),
  has_identifiable_person boolean not null default false,
  person_consent boolean not null default false,
  status public.content_status not null default 'visible',
  hidden_reason text,
  hidden_until timestamptz,
  answer_count integer not null default 0,
  like_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint posts_feedback_needs_photo check (board <> 'feedback' or photo_path is not null),
  constraint posts_photo_in_own_folder check (photo_path is null or starts_with(photo_path, author_id::text || '/')),
  constraint posts_person_consent check (not has_identifiable_person or person_consent),
  constraint posts_exif_whitelist check (
    exif is null
    or (jsonb_typeof(exif) = 'object'
        and (exif - array['camera', 'lens', 'focal_length', 'aperture', 'shutter', 'iso']) = '{}'::jsonb)
  )
);

create index posts_board_idx on public.posts (board, created_at desc) where status = 'visible';
create index posts_unanswered_idx on public.posts (created_at desc) where board = 'feedback' and answer_count = 0 and status = 'visible';
create index posts_author_idx on public.posts (author_id);

create table public.post_answers (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 5 and 3000),
  status public.content_status not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index post_answers_post_idx on public.post_answers (post_id, created_at);
create index post_answers_author_idx on public.post_answers (author_id);

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_likes_user_idx on public.post_likes (user_id);

-- ── 안전 ─────────────────────────────────────────────

-- 차단하면 양쪽 모두 서로의 모임, 글, 채팅이 보이지 않는다.
create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  -- 신고한 사람이 계정을 지워도 신고 기록은 남긴다
  reporter_id uuid default auth.uid() references public.profiles (id) on delete set null,
  target_kind public.report_target not null,
  target_id uuid not null,
  reason public.report_reason not null,
  detail text check (detail is null or char_length(detail) <= 2000),
  -- 긴급·불법 촬영은 바로 확인한다 (운영정책 5-1절)
  priority text generated always as (
    case when reason in ('emergency', 'illegal_filming') then 'urgent' else 'normal' end
  ) stored,
  status public.report_status not null default 'received',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text
);

create index reports_queue_idx on public.reports (status, priority, created_at);
create index reports_reporter_idx on public.reports (reporter_id);

-- 제재 기록 (운영정책 5-3절). 기간 제한은 ends_at까지, 영구 정지는 ends_at이 없다.
create table public.sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  level public.sanction_level not null,
  reason text not null,
  report_id uuid references public.reports (id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sanctions_period check (
    (level in ('warning', 'permanent') and ends_at is null)
    or (level in ('restricted_7d', 'restricted_30d') and ends_at is not null and ends_at > starts_at)
  )
);

create index sanctions_user_idx on public.sanctions (user_id, starts_at desc);
