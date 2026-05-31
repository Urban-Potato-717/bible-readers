import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin, VERIFICATION_BUCKET } from "@/lib/supabase";
import { loadFeed } from "@/lib/messages";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_BODY_LEN = 4000;

export async function GET(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const url = new URL(req.url);
  const before = url.searchParams.get("before");
  const after = url.searchParams.get("after");

  const messages = await loadFeed({ meId: me.id, before, after });
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const form = await req.formData();
  const body = ((form.get("body") as string) || "").trim().slice(0, MAX_BODY_LEN);
  const photo = form.get("photo") as File | null;

  if (!body && (!photo || photo.size === 0)) {
    return NextResponse.json({ error: "메시지를 입력하세요" }, { status: 400 });
  }

  let photo_path: string | null = null;
  if (photo && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "사진은 8MB 이하" }, { status: 413 });
    }
    if (!photo.type.startsWith("image/")) {
      return NextResponse.json({ error: "이미지 파일만 가능" }, { status: 400 });
    }
    const ext =
      photo.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `chat/${me.id}/${Date.now()}.${ext}`;
    const buf = Buffer.from(await photo.arrayBuffer());
    const { error: upErr } = await supabaseAdmin.storage
      .from(VERIFICATION_BUCKET)
      .upload(path, buf, { contentType: photo.type, upsert: true });
    if (upErr) {
      return NextResponse.json({ error: `업로드 실패: ${upErr.message}` }, { status: 500 });
    }
    photo_path = path;
  }

  const { error } = await supabaseAdmin.from("messages").insert({
    user_id: me.id,
    kind: "chat",
    body: body || null,
    photo_path,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
