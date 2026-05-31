// Vercel Cron은 CRON_SECRET을 Authorization: Bearer 헤더로 보낸다.
// 로컬에서 수동 실행할 때도 같은 헤더를 사용해 보호한다.

export function assertCronAuth(req: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new Response("CRON_SECRET 미설정", { status: 500 });
  }
  const got = req.headers.get("authorization");
  if (got !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
