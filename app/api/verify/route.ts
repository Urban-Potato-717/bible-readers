import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin, VERIFICATION_BUCKET } from "@/lib/supabase";
import { currentReadingDate } from "@/lib/dates";
import { ALLOWED_IMAGE_TYPES } from "@/lib/chat";
import { sendToUsers } from "@/lib/push";

export const preferredRegion = "icn1";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const form = await req.formData();
  const rawDate = form.get("date");
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const date =
    typeof rawDate === "string" && DATE_RE.test(rawDate)
      ? rawDate
      : currentReadingDate();
  const text = ((form.get("text") as string) || "").trim();
  const photo = form.get("photo") as File | null;

  if (!text && (!photo || photo.size === 0)) {
    return NextResponse.json({ error: "읽은 장 또는 사진이 필요합니다" }, { status: 400 });
  }

  let photo_path: string | undefined;
  if (photo && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "사진은 8MB 이하" }, { status: 413 });
    }
    if (!ALLOWED_IMAGE_TYPES.includes(photo.type as never)) {
      return NextResponse.json(
        { error: "JPG/PNG/WEBP/GIF 이미지만 가능" },
        { status: 400 }
      );
    }
    const ext = photo.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${me.id}/${date}-${Date.now()}.${ext}`;
    const buf = Buffer.from(await photo.arrayBuffer());
    const { error: upErr } = await supabaseAdmin.storage
      .from(VERIFICATION_BUCKET)
      .upload(path, buf, {
        contentType: photo.type,
        upsert: true,
      });
    if (upErr) {
      return NextResponse.json({ error: `업로드 실패: ${upErr.message}` }, { status: 500 });
    }
    photo_path = path;
  }

  // 기존 인증이 있으면 사진 정리 후 덮어쓰기
  const { data: existing } = await supabaseAdmin
    .from("verifications")
    .select("id, photo_path")
    .eq("user_id", me.id)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    if (photo_path && existing.photo_path && existing.photo_path !== photo_path) {
      await supabaseAdmin.storage
        .from(VERIFICATION_BUCKET)
        .remove([existing.photo_path]);
    }
    const { error } = await supabaseAdmin
      .from("verifications")
      .update({
        text: text || null,
        photo_path: photo_path ?? existing.photo_path,
      })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin.from("verifications").insert({
      user_id: me.id,
      date,
      text: text || null,
      photo_path: photo_path ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 이 날짜에 pending 벌금이 있으면 자동 취소 (인증을 늦게라도 한 경우)
  await supabaseAdmin
    .from("fines")
    .delete()
    .eq("user_id", me.id)
    .eq("date", date)
    .eq("status", "pending");

  // 채팅방 피드에 인증 메시지 반영 (날짜당 1건 유지)
  const { data: existingMsg } = await supabaseAdmin
    .from("messages")
    .select("id")
    .eq("user_id", me.id)
    .eq("kind", "verification")
    .eq("date", date)
    .maybeSingle();

  if (existingMsg) {
    await supabaseAdmin
      .from("messages")
      .update({ body: text || null, photo_path: photo_path ?? existing?.photo_path ?? null })
      .eq("id", existingMsg.id);
  } else {
    await supabaseAdmin.from("messages").insert({
      user_id: me.id,
      kind: "verification",
      date,
      body: text || null,
      photo_path: photo_path ?? null,
    });
  }

  // Notify the other members (never the actor). Fire-and-forget: push failures
  // must not fail the verification itself.
  try {
    const { data: others } = await supabaseAdmin
      .from("users")
      .select("id")
      .neq("id", me.id);
    const ids = (others ?? []).map((u) => u.id);
    await sendToUsers(ids, {
      title: `${me.name}님 인증 완료! 📖`,
      body: text ? text.slice(0, 80) : "오늘 분량 읽었어요",
      url: "/",
    });
  } catch (err) {
    console.warn("[verify] push notify failed", (err as Error).message);
  }

  return NextResponse.json({ ok: true });
}
