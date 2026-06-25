# Bible Readers

소규모 고정 그룹(~8명)을 위한 매일 성경 읽기 인증 PWA. 인증을 빠뜨리면 자동으로 벌금(1,000원)이 부과되고, 공유 채팅 피드에서 서로의 인증 현황을 확인할 수 있다.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2 (App Router) / React 19 / TypeScript |
| Styling | Tailwind CSS v4 |
| Database & Storage | Supabase (PostgreSQL + Storage) |
| Deployment | Vercel (Serverless Functions + Cron) |
| Push Notifications | Web Push API (VAPID) |
| Auth | Custom HMAC cookie session + bcrypt PIN |

---

## Features

- **인증 피드** — 텍스트/사진으로 매일 읽기 인증 게시. 이모지 리액션 지원
- **자동 벌금 시스템** — Vercel Cron이 매일 KST 1시에 전날 미인증자에게 1,000원 자동 부과
- **캘린더 / 벌금 현황** — 멤버별 인증 달력 및 누적 벌금 조회
- **관리자 패널** — 벌금 납부 확인, 미인증일 사후 인증 처리
- **Web Push 알림** — 다른 멤버 인증 시 실시간 푸시 알림 + 저녁 리마인더
- **읽기 스트릭** — 연속 인증일 수 추적
- **PWA** — 홈 화면 설치, 다크 모드(쿠키 기반으로 설치된 앱에서도 유지)

---

## Architecture

### Auth (`lib/auth.ts`)

Supabase Auth를 사용하지 않고 커스텀 쿠키 세션을 직접 구현했다. 로그인은 이름 + 4자리 PIN 방식이며, `SESSION_SECRET`으로 HMAC-SHA256 서명된 user id를 httpOnly / Secure 쿠키에 저장한다. 세션 검증은 `timingSafeEqual`로 타이밍 공격을 방지하고, PIN은 bcrypt로 해시 저장된다. `pin_hash = null`이면 최초 로그인 시 PIN을 직접 설정하는 온보딩 플로우를 내장한다.

### Supabase 사용 방식

**RLS 비활성화 + service_role 키 서버 전용 격리** 패턴을 채택했다. 고정 멤버 소규모 앱이므로 Row Level Security 대신 모든 DB 접근을 서버사이드 API Route를 통해서만 처리하고, `SUPABASE_SERVICE_ROLE_KEY`는 절대 클라이언트에 노출되지 않는다. 클라이언트는 앱 자체의 API Route에만 `fetch`한다.

- **PostgreSQL** — users, verifications, fines, messages, reactions, push_subscriptions
- **Storage** — 단일 private 버킷(`verifications`)에 인증/채팅 사진 저장. 서명된 URL(signed URL)로만 접근하며, 서버 내 인메모리 캐시(`signedCache`)로 폴링 시 중복 서명 요청을 방지한다

### KST 날짜 모델 (`lib/dates.ts`)

벌금/캘린더가 한국 시간(UTC+9) 기준이며 **새벽 1시 컷오프**를 적용한다. 자정~01:00 KST 사이에 올린 인증은 전날 분량으로 처리된다. `currentReadingDate()` / `yesterdayKst()`가 이 로직의 단일 진입점으로, 모든 날짜 연산이 이 두 함수를 통과한다.

### 채팅 피드 (`lib/messages.ts`)

`messages` 테이블 단일 피드. `kind='chat'`은 일반 채팅, `kind='verification'`은 인증 메시지다. 인증은 `verifications` 테이블(벌금/캘린더의 source of truth)과 `messages` 테이블(피드 출력) 양쪽에 동시 기록하여 동기화한다. 피드는 `created_at` 기반 keyset pagination으로 로드하고, 클라이언트가 폴링으로 신규 메시지를 pull한다.

### Vercel Cron (`vercel.json`)

| 스케줄 (UTC) | KST | 역할 |
|---|---|---|
| `0 16 * * *` | 매일 01:00 | 전날 미인증자 벌금 자동 부과 |
| `0 17 * * *` | 매일 02:00 | 30일 지난 사진 Storage 정리 / 90일 지난 채팅 삭제 |
| `0 12 * * *` | 매일 21:00 | 당일 미인증자에게 저녁 리마인더 푸시 |

모든 cron 엔드포인트는 `Authorization: Bearer {CRON_SECRET}` 헤더를 `timingSafeEqual`로 검증한다.

### Web Push (`lib/push.ts`)

VAPID 키 기반 Web Push. 기기별로 `push_subscriptions` 테이블에 subscription을 등록하며 1인 다기기를 지원한다. 만료된 구독(HTTP 404/410)은 전송 시 자동 삭제된다. `sendToUsers()`는 항상 fire-and-forget으로 호출되어 push 실패가 메인 플로우에 영향을 주지 않는다.

---

## Deployment

**Vercel** 위에 서버리스로 배포된다. API Route가 각각 독립 서버리스 함수로 실행되며, Vercel Cron이 `vercel.json`의 스케줄에 따라 자동 호출된다. `preferredRegion = "icn1"`(Seoul)을 지정해 KST 레이턴시를 최소화한다.

```
Vercel (icn1)
├── Next.js App Router (SSR + API Routes as Serverless Functions)
├── Vercel Cron → /api/cron/*
└── Supabase (PostgreSQL + Storage)
```

1. GitHub repo push
2. Vercel → New Project → import → Environment Variables 등록
3. Deploy — `vercel.json`의 cron 스케줄이 자동 등록됨

---

## Database Schema

```
users              — 고정 멤버, bcrypt PIN 해시, 관리자 여부
verifications      — 날짜별 인증 (user_id, date UNIQUE)
fines              — 날짜별 벌금 (pending → paid)
messages           — 채팅 + 인증 피드 (kind: chat | verification)
reactions          — 메시지별 이모지 리액션 (FK cascade delete)
push_subscriptions — 기기별 Web Push 구독 정보
```

스키마는 `supabase/schema.sql` → `seed.sql` → `02_chat.sql` → `03_push.sql` 순으로 Supabase SQL Editor에서 수동 적용한다.

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # 서버 전용, 클라이언트 노출 금지
SESSION_SECRET=              # 16자 이상, HMAC 세션 서명
CRON_SECRET=                 # Vercel Cron 인증
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=               # mailto:...
```

VAPID 키 생성: `npx web-push generate-vapid-keys`

---

## Local Development

```bash
cp .env.example .env.local
# .env.local 채우기
npm run dev       # http://localhost:3000
npm run build     # 프로덕션 빌드 확인
npm run lint      # ESLint
```

---

## Recent Updates

- **Security** — cron 인증에 `timingSafeEqual` 적용 (타이밍 공격 방지), `/api/verify` date 파라미터 형식 검증으로 임의 날짜 인증 차단, Storage 삭제 실패 시 DB 레코드 보호
- **읽기 스트릭** — 연속 인증일 수 계산 및 표시
- **저녁 리마인더** — 매일 21시 미인증자 자동 알림
- **다크 모드** — 쿠키 기반으로 설치된 PWA에서도 설정 유지
- **관리자 기능** — 미인증일 사후 인증 처리로 벌금 취소
