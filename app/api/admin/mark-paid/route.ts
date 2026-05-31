import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const preferredRegion = "icn1";

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me?.is_admin) {
    return NextResponse.json({ error: "관리자 전용" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const fineIds = body?.fineIds as string[] | undefined;
  if (!Array.isArray(fineIds) || fineIds.length === 0) {
    return NextResponse.json({ error: "벌금 ID 필요" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("fines")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .in("id", fineIds)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
