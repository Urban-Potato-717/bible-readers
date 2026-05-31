import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { yesterdayKst } from "@/lib/dates";
import { assertCronAuth } from "@/lib/cron";

// 매일 KST 새벽 1시 (UTC 16:00) 실행.
// 어제 인증 안 한 사람마다 fines에 1건씩 추가.
export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const targetDate = yesterdayKst();

  const [{ data: users }, { data: verifications }, { data: existingFines }] =
    await Promise.all([
      supabaseAdmin.from("users").select("id"),
      supabaseAdmin.from("verifications").select("user_id").eq("date", targetDate),
      supabaseAdmin.from("fines").select("user_id").eq("date", targetDate),
    ]);

  const verifiedIds = new Set((verifications ?? []).map((v) => v.user_id));
  const finedIds = new Set((existingFines ?? []).map((f) => f.user_id));

  const toFine = (users ?? [])
    .filter((u) => !verifiedIds.has(u.id) && !finedIds.has(u.id))
    .map((u) => ({
      user_id: u.id,
      date: targetDate,
      amount: 1000,
      status: "pending" as const,
    }));

  if (toFine.length > 0) {
    const { error } = await supabaseAdmin.from("fines").insert(toFine);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    date: targetDate,
    fined: toFine.length,
  });
}
