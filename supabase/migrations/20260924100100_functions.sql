-- 포토그래핑 DB v1: 함수와 트리거
-- 보안 규칙: security definer 함수는 search_path를 비우고 모든 이름을 스키마까지 적는다.
-- 앱이 부르는 함수(RPC)는 오류 hint에 기계용 코드를 넣는다. 예: hint = 'meetup_full'

-- ── 공통 ─────────────────────────────────────────────

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger meetups_updated_at before update on public.meetups
  for each row execute function public.set_updated_at();
create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();
create trigger post_answers_updated_at before update on public.post_answers
  for each row execute function public.set_updated_at();

-- 관리자는 JWT의 app_metadata.role = 'admin'. app_metadata는 서버(service role)만 바꿀 수 있다.
create function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create function public.raise_app_error(p_code text, p_message text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_message, hint = p_code;
end;
$$;

-- ── 권한 판단에 쓰는 함수 (RLS 정책에서 부른다) ────────
-- 다른 사람의 행을 봐야 판단할 수 있어서 security definer로 만든다.

create function public.is_verified(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = p_user_id and verified_at is not null);
$$;

create function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

-- 지금 이용 제한(7일·30일·영구) 중인가. 경고는 제한이 아니다.
create function public.is_sanctioned(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sanctions
    where user_id = p_user_id
      and level <> 'warning'
      and starts_at <= now()
      and (ends_at is null or ends_at > now())
  );
$$;

create function public.is_meetup_host(p_meetup_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.meetups where id = p_meetup_id and host_id = p_user_id);
$$;

create function public.is_confirmed_member(p_meetup_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meetup_participants
    where meetup_id = p_meetup_id and user_id = p_user_id and status = 'confirmed'
  );
$$;

-- 모임 채팅은 모임이 열려 있고 끝난 뒤 7일까지 쓸 수 있다
create function public.is_chat_open(p_meetup_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meetups
    where id = p_meetup_id and status = 'open' and ends_at + interval '7 days' > now()
  );
$$;

-- 노쇼 제한 (운영정책 4-2절). 앱의 mobile/src/domain/noShow.ts와 같은 규칙이다.
-- 최근 90일 노쇼 1회: 경고 / 2회: 마지막 노쇼 모임부터 14일 제한 / 3회 이상: 30일 제한, 이후 승인제 모임만
create function public.no_show_restriction(p_user_id uuid, p_now timestamptz default now())
returns table (kind text, no_show_count integer, blocked_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with recent as (
    select m.starts_at
    from public.meetup_participants mp
    join public.meetups m on m.id = mp.meetup_id
    where mp.user_id = p_user_id
      and mp.attendance = 'no_show'
      and m.starts_at >= p_now - interval '90 days'
      and m.starts_at <= p_now
  ),
  agg as (
    select count(*)::integer as n,
           max(starts_at) + case when count(*) = 2 then interval '14 days' else interval '30 days' end as until
    from recent
  )
  select
    case
      when n = 0 then 'none'
      when n = 1 then 'warning'
      when p_now < until then 'blocked'
      when n = 2 then 'warning'
      else 'approval_only'
    end,
    n,
    case when n >= 2 and p_now < until then until end
  from agg;
$$;

-- 모임을 열 수 있는가 (운영정책 4-1절): 본인인증, 제재 없음, 참석 1회 이상 또는 창립 모임장
create function public.can_host(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.profile_stats s on s.user_id = p.id
    where p.id = p_user_id
      and p.verified_at is not null
      and (p.is_founding_host or s.attended >= 1)
  ) and not public.is_sanctioned(p_user_id);
$$;

-- 매너 평가를 남길 수 있는가: 모임이 끝났고 7일이 지나지 않았으며, 두 사람 모두 그 자리에 있었음
create function public.can_review(p_meetup_id uuid, p_reviewer uuid, p_reviewee uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_reviewer <> p_reviewee
    and exists (
      select 1 from public.meetups m
      where m.id = p_meetup_id and m.status = 'open'
        and m.ends_at <= now() and m.ends_at + interval '7 days' > now()
    )
    and (
      select count(*) from public.meetup_participants mp
      where mp.meetup_id = p_meetup_id
        and mp.user_id in (p_reviewer, p_reviewee)
        and mp.status = 'confirmed'
        and (mp.role = 'host' or mp.attendance = 'attended')
    ) = 2;
$$;

-- ── 신뢰도 통계 ──────────────────────────────────────

create function public.refresh_profile_stats(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profile_stats s set
    attended = (select count(*) from public.meetup_participants
                where user_id = p_user_id and attendance = 'attended'),
    no_shows = (select count(*) from public.meetup_participants
                where user_id = p_user_id and attendance = 'no_show'),
    late_cancels = (select count(*) from public.meetup_participants
                    where user_id = p_user_id and late_cancel),
    hosted = (select count(*) from public.meetups where host_id = p_user_id and status = 'open'),
    hosted_canceled = (select count(*) from public.meetups where host_id = p_user_id and status = 'canceled'),
    manner_sum = (select coalesce(sum(score), 0) from public.meetup_reviews where reviewee_id = p_user_id),
    manner_count = (select count(*) from public.meetup_reviews where reviewee_id = p_user_id),
    updated_at = now()
  where s.user_id = p_user_id;
$$;

create function public.profiles_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile_stats (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger profiles_create_stats after insert on public.profiles
  for each row execute function public.profiles_after_insert();

create function public.participants_refresh_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_profile_stats(old.user_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.user_id <> old.user_id) then
    perform public.refresh_profile_stats(new.user_id);
  end if;
  return null;
end;
$$;

create trigger meetup_participants_stats
  after insert or update of status, late_cancel, attendance or delete on public.meetup_participants
  for each row execute function public.participants_refresh_stats();

create function public.reviews_refresh_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_profile_stats(coalesce(new.reviewee_id, old.reviewee_id));
  return null;
end;
$$;

create trigger meetup_reviews_stats after insert or update or delete on public.meetup_reviews
  for each row execute function public.reviews_refresh_stats();

-- ── 모임 ─────────────────────────────────────────────

create function public.meetups_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_confirmed integer;
begin
  if tg_op = 'INSERT' then
    -- 사용자 요청일 때만 시간 제한을 건다. 서버 작업(시드·관리)은 auth.uid()가 없다.
    if auth.uid() is not null and new.starts_at < now() + interval '1 hour' then
      perform public.raise_app_error('starts_too_soon', '모임은 지금부터 1시간 뒤 이후로 열 수 있어요.');
    end if;
    new.status := 'open';
    new.canceled_at := null;
    return new;
  end if;

  if new.host_id <> old.host_id then
    perform public.raise_app_error('host_immutable', '모임장은 바꿀 수 없어요.');
  end if;
  if new.capacity < old.capacity then
    select count(*) into v_confirmed from public.meetup_participants
    where meetup_id = new.id and status = 'confirmed';
    if new.capacity < v_confirmed then
      perform public.raise_app_error('capacity_below_confirmed', '이미 확정된 인원보다 적게 줄일 수 없어요.');
    end if;
  end if;
  return new;
end;
$$;

create trigger meetups_validate before insert or update on public.meetups
  for each row execute function public.meetups_before_write();

-- 모임을 만들면 모임장이 첫 참여자가 된다
create function public.meetups_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.meetup_participants (meetup_id, user_id, role, status, decided_at)
    values (new.id, new.host_id, 'host', 'confirmed', now());
  end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    perform public.refresh_profile_stats(new.host_id);
  end if;
  return null;
end;
$$;

create trigger meetups_after_write after insert or update of status on public.meetups
  for each row execute function public.meetups_after_write();

-- 참여 신청. 정원·대상·차단·노쇼 제한을 한 곳에서 확인하고, 동시에 신청해도 정원을 넘지 않게 모임 행을 잠근다.
-- 반환: 'pending'(승인 대기) 또는 'confirmed'(확정)
create function public.join_meetup(p_meetup_id uuid)
returns public.participant_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_meetup public.meetups;
  v_existing public.meetup_participants;
  v_restriction record;
  v_confirmed integer;
  v_status public.participant_status;
begin
  if v_uid is null then
    perform public.raise_app_error('not_signed_in', '로그인이 필요해요.');
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.id is null or v_profile.verified_at is null then
    perform public.raise_app_error('not_verified', '본인인증을 마치면 모임에 참여할 수 있어요.');
  end if;
  if public.is_sanctioned(v_uid) then
    perform public.raise_app_error('sanctioned', '이용이 제한된 상태라 모임에 참여할 수 없어요.');
  end if;

  select * into v_meetup from public.meetups where id = p_meetup_id for update;
  if v_meetup.id is null or public.is_blocked_between(v_uid, v_meetup.host_id) then
    perform public.raise_app_error('meetup_not_found', '모임을 찾을 수 없어요.');
  end if;
  if v_meetup.status <> 'open' then
    perform public.raise_app_error('meetup_canceled', '취소된 모임이에요.');
  end if;
  if v_meetup.starts_at <= now() then
    perform public.raise_app_error('meetup_started', '이미 시작한 모임이에요.');
  end if;
  if v_meetup.host_id = v_uid then
    perform public.raise_app_error('own_meetup', '내가 연 모임이에요.');
  end if;
  if cardinality(v_meetup.target_types) > 0 and not (v_profile.activity_type = any (v_meetup.target_types)) then
    perform public.raise_app_error('not_target_type', '이 모임의 대상 유형이 아니에요.');
  end if;
  if cardinality(v_meetup.target_ages) > 0
     and (v_profile.age_band is null or not (v_profile.age_band = any (v_meetup.target_ages))) then
    perform public.raise_app_error('not_target_age', '이 모임의 대상 연령대가 아니에요.');
  end if;

  select * into v_restriction from public.no_show_restriction(v_uid);
  if v_restriction.kind = 'blocked' then
    perform public.raise_app_error(
      'no_show_blocked',
      format('노쇼가 많아 %s까지 모임을 신청할 수 없어요.',
             to_char(v_restriction.blocked_until at time zone 'Asia/Seoul', 'FMMM월 FMDD일'))
    );
  end if;
  if v_restriction.kind = 'approval_only' and not v_meetup.requires_approval then
    perform public.raise_app_error('approval_only', '당분간 모임장 승인제 모임만 신청할 수 있어요.');
  end if;

  select * into v_existing from public.meetup_participants where meetup_id = p_meetup_id and user_id = v_uid;
  if v_existing.status in ('pending', 'confirmed') then
    return v_existing.status;
  end if;
  if v_existing.status = 'declined' then
    perform public.raise_app_error('declined', '모임장이 거절한 모임은 다시 신청할 수 없어요.');
  end if;

  select count(*) into v_confirmed from public.meetup_participants
  where meetup_id = p_meetup_id and status = 'confirmed';
  if v_confirmed >= v_meetup.capacity then
    perform public.raise_app_error('meetup_full', '마감된 모임이에요.');
  end if;

  v_status := case when v_meetup.requires_approval then 'pending' else 'confirmed' end;

  insert into public.meetup_participants (meetup_id, user_id, role, status, requested_at, decided_at)
  values (p_meetup_id, v_uid, 'member', v_status, now(), case when v_status = 'confirmed' then now() end)
  on conflict (meetup_id, user_id) do update
    set status = excluded.status,
        requested_at = excluded.requested_at,
        decided_at = excluded.decided_at,
        canceled_at = null;

  return v_status;
end;
$$;

-- 참여 취소. 시작 24시간 이내에 확정 참여를 취소하면 늦은 취소로 기록한다.
-- 반환: 늦은 취소였는지
create function public.cancel_participation(p_meetup_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_meetup public.meetups;
  v_row public.meetup_participants;
  v_late boolean := false;
begin
  select * into v_meetup from public.meetups where id = p_meetup_id for update;
  select * into v_row from public.meetup_participants where meetup_id = p_meetup_id and user_id = v_uid;

  if v_uid is null or v_row.meetup_id is null or v_row.status not in ('pending', 'confirmed') then
    perform public.raise_app_error('not_participating', '참여 중인 모임이 아니에요.');
  end if;
  if v_row.role = 'host' then
    perform public.raise_app_error('host_cannot_leave', '모임장은 참여를 취소할 수 없어요. 모임 취소를 이용해 주세요.');
  end if;
  if v_meetup.starts_at <= now() then
    perform public.raise_app_error('meetup_started', '이미 시작한 모임은 취소할 수 없어요.');
  end if;

  v_late := v_row.status = 'confirmed' and v_meetup.starts_at - now() < interval '24 hours';

  update public.meetup_participants
  set status = 'canceled',
      canceled_at = now(),
      late_cancel = late_cancel or v_late
  where meetup_id = p_meetup_id and user_id = v_uid;

  return v_late;
end;
$$;

-- 모임장이 참여 신청을 승인하거나 거절한다
create function public.decide_join_request(p_meetup_id uuid, p_user_id uuid, p_approve boolean)
returns public.participant_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meetup public.meetups;
  v_row public.meetup_participants;
  v_confirmed integer;
  v_status public.participant_status;
begin
  select * into v_meetup from public.meetups where id = p_meetup_id for update;
  if v_meetup.id is null or v_meetup.host_id is distinct from auth.uid() then
    perform public.raise_app_error('not_host', '모임장만 신청을 처리할 수 있어요.');
  end if;

  select * into v_row from public.meetup_participants where meetup_id = p_meetup_id and user_id = p_user_id;
  if v_row.status is distinct from 'pending' then
    perform public.raise_app_error('not_pending', '승인을 기다리는 신청이 아니에요.');
  end if;

  if p_approve then
    select count(*) into v_confirmed from public.meetup_participants
    where meetup_id = p_meetup_id and status = 'confirmed';
    if v_confirmed >= v_meetup.capacity then
      perform public.raise_app_error('meetup_full', '정원이 다 찼어요.');
    end if;
  end if;

  v_status := case when p_approve then 'confirmed' else 'declined' end;
  update public.meetup_participants set status = v_status, decided_at = now()
  where meetup_id = p_meetup_id and user_id = p_user_id;
  return v_status;
end;
$$;

-- 모임장이 출석을 체크한다. 모임이 시작한 뒤부터 끝나고 7일까지.
create function public.mark_attendance(p_meetup_id uuid, p_user_id uuid, p_attended boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meetup public.meetups;
begin
  select * into v_meetup from public.meetups where id = p_meetup_id;
  if v_meetup.id is null or v_meetup.host_id is distinct from auth.uid() then
    perform public.raise_app_error('not_host', '모임장만 출석을 체크할 수 있어요.');
  end if;
  if v_meetup.starts_at > now() then
    perform public.raise_app_error('not_started', '모임이 시작한 뒤에 출석을 체크할 수 있어요.');
  end if;
  if v_meetup.ends_at + interval '7 days' < now() then
    perform public.raise_app_error('attendance_closed', '모임이 끝나고 7일이 지나 출석을 바꿀 수 없어요.');
  end if;

  update public.meetup_participants
  set attendance = case when p_attended then 'attended'::public.attendance else 'no_show'::public.attendance end,
      attendance_marked_at = now()
  where meetup_id = p_meetup_id and user_id = p_user_id and role = 'member' and status = 'confirmed';

  if not found then
    perform public.raise_app_error('not_participant', '확정된 참여자가 아니에요.');
  end if;
end;
$$;

-- 모임장이 모임을 취소한다. 시작한 뒤에는 취소할 수 없다.
create function public.cancel_meetup(p_meetup_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meetup public.meetups;
begin
  select * into v_meetup from public.meetups where id = p_meetup_id for update;
  if v_meetup.id is null or v_meetup.host_id is distinct from auth.uid() then
    perform public.raise_app_error('not_host', '모임장만 모임을 취소할 수 있어요.');
  end if;
  if v_meetup.status = 'canceled' then
    return;
  end if;
  if v_meetup.starts_at <= now() then
    perform public.raise_app_error('meetup_started', '이미 시작한 모임은 취소할 수 없어요.');
  end if;

  update public.meetups
  set status = 'canceled', canceled_at = now(), cancel_reason = nullif(btrim(p_reason), '')
  where id = p_meetup_id;
end;
$$;

-- ── 본인인증과 계정 ──────────────────────────────────

create function public.age_band_for(p_birth_year integer, p_today date default (now() at time zone 'Asia/Seoul')::date)
returns public.age_band
language sql
immutable
set search_path = ''
as $$
  -- 출생 연도만 저장하므로 생일 전후 1살 차이는 무시한다
  select case
    when extract(year from p_today)::integer - p_birth_year < 30 then '20s'::public.age_band
    when extract(year from p_today)::integer - p_birth_year < 40 then '30s'::public.age_band
    when extract(year from p_today)::integer - p_birth_year < 50 then '40s'::public.age_band
    else '50plus'::public.age_band
  end;
$$;

-- 본인인증 결과 기록. 본인인증 대행사 응답을 받은 서버(Edge Function, service role)만 부른다.
-- 만 19세 미만, 영구 정지된 사람, 이미 다른 계정으로 인증한 사람은 막는다.
create function public.record_identity_verification(
  p_user_id uuid,
  p_ci_hash text,
  p_birth_date date,
  p_provider text
)
returns public.age_band
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_band public.age_band;
begin
  if p_birth_date + interval '19 years' > (now() at time zone 'Asia/Seoul')::date then
    perform public.raise_app_error('underage', '만 19세 이상만 가입할 수 있어요.');
  end if;
  if exists (select 1 from public.banned_identities where ci_hash = p_ci_hash) then
    perform public.raise_app_error('banned', '이용이 영구 정지된 정보로는 가입할 수 없어요.');
  end if;
  if exists (select 1 from public.identity_verifications where ci_hash = p_ci_hash and user_id <> p_user_id) then
    perform public.raise_app_error('already_registered', '이미 다른 계정으로 가입했어요.');
  end if;

  insert into public.identity_verifications (user_id, ci_hash, birth_year, provider)
  values (p_user_id, p_ci_hash, extract(year from p_birth_date)::smallint, p_provider)
  on conflict (user_id) do update
    set ci_hash = excluded.ci_hash, birth_year = excluded.birth_year,
        provider = excluded.provider, verified_at = now();

  v_band := public.age_band_for(extract(year from p_birth_date)::integer);
  update public.profiles set verified_at = now(), age_band = v_band where id = p_user_id;
  return v_band;
end;
$$;

-- 인증을 먼저 하고 프로필을 나중에 만든 경우에도 인증 결과를 이어 받는다
create function public.profiles_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iv public.identity_verifications;
begin
  select * into v_iv from public.identity_verifications where user_id = new.id;
  if v_iv.user_id is not null then
    new.verified_at := v_iv.verified_at;
    new.age_band := public.age_band_for(v_iv.birth_year);
  elsif auth.uid() is not null then
    -- 사용자는 스스로 인증 상태를 만들 수 없다. 서버 작업(시드)은 값을 그대로 둔다.
    new.verified_at := null;
    new.age_band := null;
  end if;
  if auth.uid() is not null then
    new.is_founding_host := false;
  end if;
  return new;
end;
$$;

create trigger profiles_apply_verification before insert on public.profiles
  for each row execute function public.profiles_before_insert();

-- 해가 바뀌면 연령대를 다시 계산한다. 매년 1월 1일에 서버에서 부른다 (예: pg_cron).
create function public.refresh_age_bands()
returns integer
language sql
security definer
set search_path = ''
as $$
  with changed as (
    update public.profiles p
    set age_band = public.age_band_for(iv.birth_year)
    from public.identity_verifications iv
    where iv.user_id = p.id and p.age_band is distinct from public.age_band_for(iv.birth_year)
    returning 1
  )
  select count(*)::integer from changed;
$$;

-- 앱 안에서 계정 삭제 (Apple 5.1.1(v)). 프로필, 참여 기록, 글, 채팅이 함께 지워진다.
-- Apple 로그인 토큰 해지는 Edge Function에서 이 함수를 부르기 전에 한다.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    perform public.raise_app_error('not_signed_in', '로그인이 필요해요.');
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ── 커뮤니티 카운터 ──────────────────────────────────

create function public.post_answers_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_id uuid := coalesce(new.post_id, old.post_id);
begin
  update public.posts
  set answer_count = (select count(*) from public.post_answers where post_id = v_post_id and status = 'visible')
  where id = v_post_id;
  return null;
end;
$$;

create trigger post_answers_count after insert or delete or update of status on public.post_answers
  for each row execute function public.post_answers_count();

create function public.post_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_id uuid := coalesce(new.post_id, old.post_id);
begin
  update public.posts
  set like_count = (select count(*) from public.post_likes where post_id = v_post_id)
  where id = v_post_id;
  return null;
end;
$$;

create trigger post_likes_count after insert or delete on public.post_likes
  for each row execute function public.post_likes_count();

-- ── 신고와 제재 ──────────────────────────────────────

-- 불법 촬영 신고가 들어오면 그 콘텐츠를 즉시 가린다 (운영정책 5-1절, 5-4절). 판단은 운영팀이 한다.
create function public.reports_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reason = 'illegal_filming' then
    if new.target_kind = 'post' then
      update public.posts set status = 'hidden', hidden_reason = 'report:illegal_filming'
      where id = new.target_id and status = 'visible';
    elsif new.target_kind = 'answer' then
      update public.post_answers set status = 'hidden' where id = new.target_id;
    elsif new.target_kind = 'chat_message' then
      update public.chat_messages set status = 'hidden' where id = new.target_id;
    end if;
  end if;
  return null;
end;
$$;

create trigger reports_auto_hide after insert on public.reports
  for each row execute function public.reports_after_insert();

create function public.sanctions_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ends_at is null then
    new.ends_at := case new.level
      when 'restricted_7d' then new.starts_at + interval '7 days'
      when 'restricted_30d' then new.starts_at + interval '30 days'
    end;
  end if;
  return new;
end;
$$;

create trigger sanctions_period before insert on public.sanctions
  for each row execute function public.sanctions_before_insert();

-- ── 관리자 함수 ──────────────────────────────────────

create function public.moderate_content(p_kind public.report_target, p_id uuid, p_visible boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    perform public.raise_app_error('not_admin', '관리자만 할 수 있어요.');
  end if;
  if p_kind = 'post' then
    update public.posts
    set status = case when p_visible then 'visible'::public.content_status else 'hidden'::public.content_status end,
        hidden_reason = case when p_visible then null else p_reason end,
        -- 권리침해 임시조치는 최대 30일 (정보통신망법 제44조의2, 운영정책 5-2절)
        hidden_until = case when p_visible then null else now() + interval '30 days' end
    where id = p_id;
  elsif p_kind = 'answer' then
    update public.post_answers
    set status = case when p_visible then 'visible'::public.content_status else 'hidden'::public.content_status end
    where id = p_id;
  elsif p_kind = 'chat_message' then
    update public.chat_messages
    set status = case when p_visible then 'visible'::public.content_status else 'hidden'::public.content_status end
    where id = p_id;
  else
    perform public.raise_app_error('unsupported_kind', '가릴 수 없는 대상이에요.');
  end if;
end;
$$;

create function public.apply_sanction(p_user_id uuid, p_level public.sanction_level, p_reason text, p_report_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    perform public.raise_app_error('not_admin', '관리자만 할 수 있어요.');
  end if;
  insert into public.sanctions (user_id, level, reason, report_id)
  values (p_user_id, p_level, p_reason, p_report_id)
  returning id into v_id;

  -- 영구 정지하면 같은 본인인증 정보로 다시 가입하지 못하게 한다
  if p_level = 'permanent' then
    insert into public.banned_identities (ci_hash, reason)
    select ci_hash, p_reason from public.identity_verifications where user_id = p_user_id
    on conflict (ci_hash) do nothing;
  end if;
  return v_id;
end;
$$;

create function public.resolve_report(p_report_id uuid, p_status public.report_status, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    perform public.raise_app_error('not_admin', '관리자만 할 수 있어요.');
  end if;
  update public.reports
  set status = p_status,
      resolution_note = p_note,
      resolved_at = case when p_status in ('actioned', 'dismissed') then now() end
  where id = p_report_id;
end;
$$;

create function public.set_founding_host(p_user_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    perform public.raise_app_error('not_admin', '관리자만 할 수 있어요.');
  end if;
  update public.profiles set is_founding_host = p_value where id = p_user_id;
end;
$$;
