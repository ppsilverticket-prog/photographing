-- 포토그래핑 DB v1: 사진 저장소와 실시간 채팅
-- 이 파일은 Supabase의 storage 스키마와 supabase_realtime 발행에 기대므로 Supabase에서만 동작한다.

-- 피드백 요청 사진. 앱에서 GPS를 지우고 긴 변 2048px JPEG로 다시 저장한 뒤 올린다 (운영정책 D2).
-- 비공개 버킷이라 앱은 서명된 URL로 보여 준다. 가려진 글의 사진이 링크로 퍼지는 것을 줄인다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- 경로 규칙: "{내 user id}/{파일명}.jpg". posts.photo_path도 같은 규칙을 검사한다.
create policy "post-photos: 내 폴더에만 올리기" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "post-photos: 로그인한 사람은 보기" on storage.objects
  for select to authenticated
  using (bucket_id = 'post-photos');

create policy "post-photos: 내 사진 지우기" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 모임 채팅을 실시간으로 받는다. 읽기 권한은 chat_messages의 RLS를 그대로 따른다.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end;
$$;
