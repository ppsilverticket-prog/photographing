# 포토그래핑 DB (Supabase)

설계와 규칙 설명은 [`../docs/08-database.md`](../docs/08-database.md)에 있습니다.

| 파일 | 내용 |
|---|---|
| `migrations/20260924100000_schema.sql` | 타입, 테이블, 제약 조건, 인덱스 |
| `migrations/20260924100100_functions.sql` | 권한 판단 함수, 앱이 부르는 함수(참여·취소·승인·출석·계정 삭제), 관리자 함수, 트리거 |
| `migrations/20260924100200_policies.sql` | 권한 회수, 열 단위 권한, RLS 정책 |
| `migrations/20260924100300_storage_realtime.sql` | 사진 버킷과 정책, 채팅 실시간 발행 (Supabase 전용) |
| `tests/supabase_stub.sql` | 로컬 Postgres에서 Supabase 역할·auth·storage를 흉내 내는 테스트 전용 파일 |
| `tests/db.test.mjs` | 권한과 규칙 테스트 29개 |

```bash
npm install
DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres npm test
```

`DATABASE_URL`은 데이터베이스를 새로 만들 수 있는 계정이어야 합니다. 테스트는 `photographing_test_*` 데이터베이스를 만들어 쓰고 끝나면 지웁니다.
