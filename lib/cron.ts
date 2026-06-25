// Vercel Cron은 CRON_SECRET을 Authorization: Bearer 헤더로 보낸다.
// 로컬에서 수동 실행할 때도 같은 헤더를 사용해 보호한다.

import { timingSafeEqual } from "node:crypto";

export function assertCronAuth(req: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new Response("CRON_SECRET 미설정", { status: 500 });
  }
  const got = req.headers.get("authorization") ?? "";
  const expectedHeader = `Bearer ${expected}`;
  const gotBuf = Buffer.from(got.padEnd(expectedHeader.length));
  const expBuf = Buffer.from(expectedHeader.padEnd(got.length));
  const match =
    got.length === expectedHeader.length &&
    timingSafeEqual(gotBuf, expBuf);
  if (!match) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
