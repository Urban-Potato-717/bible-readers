# 성경 읽기방

매일 성경 인증 + 미인증 시 자동 벌금 1,000원 (새벽 1시 컷). 8명 단톡방 전용 미니 PWA.

## 기능
- 이름 + PIN 4자리 로그인 (첫 로그인 시 PIN 등록)
- 사진/텍스트 인증 (둘 중 하나만 있어도 OK)
- 내 캘린더 + 전체 캘린더
- 벌금 현황판 (확정 / 미정산)
- 관리자: 입금 확인 후 "납부 완료" 처리
- 매일 새벽 1시 자동 미인증자 벌금 부과 (Vercel Cron)
- 30일 지난 사진 자동 삭제 (Storage 절약)
- PWA — 홈 화면에 추가하면 앱처럼 사용

## 셋업

### 1) Supabase 프로젝트 만들기
1. https://supabase.com → New Project (무료 티어 OK)
2. 프로젝트 생성 후 **SQL Editor** 에서 다음 순서로 실행:
   - `supabase/schema.sql` → 테이블 + Storage 버킷 생성
   - `supabase/seed.sql` → 8명 초기 사용자 + 기존 누적 벌금
3. **Settings → API** 에서 두 값 복사:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (절대 클라이언트 노출 금지)

### 2) 환경 변수 (.env.local)
```bash
cp .env.example .env.local
# .env.local 채우기:
#   NEXT_PUBLIC_SUPABASE_URL=...
#   SUPABASE_SERVICE_ROLE_KEY=...
#   SESSION_SECRET=<openssl rand -base64 32>
#   CRON_SECRET=<openssl rand -base64 32>
```

### 3) 로컬 실행
```bash
npm run dev
# http://localhost:3000
```

### 4) Vercel 배포
1. GitHub repo로 push
2. https://vercel.com → New Project → import
3. **Environment Variables** 에 .env.local 4개 모두 등록
4. Deploy
5. 배포된 URL을 단톡방에 공유 → 멤버들이 "홈 화면에 추가" 하면 끝

### 5) Cron 확인
- Vercel은 `vercel.json` 의 `crons` 를 자동 등록
- 스케줄:
  - `assess-fines`: 매일 UTC 16:00 = **KST 새벽 1시** (어제 미인증자 벌금)
  - `cleanup-photos`: 매일 UTC 17:00 = KST 새벽 2시 (30일 지난 사진 정리)
- Vercel Dashboard → Settings → Cron Jobs 에서 수동 실행 / 로그 확인 가능

## 첫 사용 흐름
1. 멤버들에게 배포 URL 공유 + "홈 화면에 추가" 안내
2. 각자 자기 이름 선택 → 원하는 PIN 4자리 입력 → 자동 등록
3. 매일 성경 읽고 "오늘" 탭에서 인증 (사진 or 텍스트)
4. 미인증 시 새벽 1시에 자동으로 벌금 1건 생성
5. 멤버가 카카오뱅크로 송금 → 김준영이 "관리" 탭에서 납부 완료 처리

## 멤버 추가/변경
SQL Editor 에서:
```sql
insert into public.users (name) values ('새멤버');
-- 첫 로그인 시 본인이 PIN 설정
```

## 벌금 수동 보정
```sql
-- 잘못 부과된 벌금 취소
delete from public.fines where user_id = '...' and date = '2026-05-27';

-- 누적 납부액 직접 조정 (앱 도입 이전 분)
update public.users set legacy_paid_total = 20000 where name = '김준영';
```

## 스택
- Next.js 16 (App Router) + TypeScript + Tailwind v4
- Supabase (Postgres + Storage)
- Vercel (Hosting + Cron)
- 인증: 자체 PIN 해시 (bcryptjs) + 서명 쿠키 (HMAC-SHA256)
