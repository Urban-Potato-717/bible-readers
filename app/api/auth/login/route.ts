import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { setSession } from "@/lib/auth";

export const preferredRegion = "icn1";

export async function POST(req: Request) {
  let body: { name?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const name = body.name?.trim();
  const pin = body.pin?.trim();

  if (!name || !pin || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "이름과 4자리 PIN을 입력해 주세요" }, { status: 400 });
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, name, pin_hash")
    .eq("name", name)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "등록되지 않은 사용자입니다" }, { status: 404 });
  }

  if (!user.pin_hash) {
    // 첫 로그인 — PIN 등록
    const hash = await bcrypt.hash(pin, 10);
    const { error: upErr } = await supabaseAdmin
      .from("users")
      .update({ pin_hash: hash })
      .eq("id", user.id);
    if (upErr) {
      return NextResponse.json({ error: "PIN 등록 실패" }, { status: 500 });
    }
  } else {
    const ok = await bcrypt.compare(pin, user.pin_hash);
    if (!ok) {
      return NextResponse.json({ error: "PIN이 일치하지 않습니다" }, { status: 401 });
    }
  }

  await setSession(user.id);
  return NextResponse.json({ ok: true });
}
