import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const preferredRegion = "icn1";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Admin-only quiet correction: marks a user as verified for a past date and
// removes that day's pending fine. No chat feed entry, no push notification.
export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me?.is_admin) {
    return NextResponse.json({ error: "관리자 전용" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const userId = body?.userId as string | undefined;
  const date = body?.date as string | undefined;
  if (!userId || !date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "userId와 날짜(YYYY-MM-DD) 필요" }, { status: 400 });
  }

  // Insert a verification only if one doesn't already exist for (user, date).
  const { data: existing } = await supabaseAdmin
    .from("verifications")
    .select("id")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabaseAdmin.from("verifications").insert({
      user_id: userId,
      date,
      text: "관리자 인증 처리",
      photo_path: null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: fineErr } = await supabaseAdmin
    .from("fines")
    .delete()
    .eq("user_id", userId)
    .eq("date", date)
    .eq("status", "pending");
  if (fineErr) return NextResponse.json({ error: fineErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
