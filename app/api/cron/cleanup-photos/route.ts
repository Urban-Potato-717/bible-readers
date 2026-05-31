import { NextResponse } from "next/server";
import { supabaseAdmin, VERIFICATION_BUCKET } from "@/lib/supabase";
import { assertCronAuth } from "@/lib/cron";
import { PHOTO_RETENTION_DAYS, CHAT_RETENTION_DAYS } from "@/lib/chat";

// Daily KST 2am.
// 1) Delete verification/chat photos older than PHOTO_RETENTION_DAYS (Storage savings).
// 2) Delete chat messages (text) older than CHAT_RETENTION_DAYS so the feed doesn't grow forever.
//    Verification messages and verification/fine records are kept.
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const photoCutoff = daysAgo(PHOTO_RETENTION_DAYS);
  const photoCutoffTs = new Date(
    Date.now() - PHOTO_RETENTION_DAYS * 86400_000
  ).toISOString();

  // --- 1) old verification photos (keyed by reading date) ---
  const { data: staleVer } = await supabaseAdmin
    .from("verifications")
    .select("id, photo_path")
    .lt("date", photoCutoff)
    .not("photo_path", "is", null);

  // --- old chat/verification message photos (keyed by created_at) ---
  const { data: staleMsg } = await supabaseAdmin
    .from("messages")
    .select("id, photo_path")
    .lt("created_at", photoCutoffTs)
    .not("photo_path", "is", null);

  const paths = [
    ...(staleVer ?? []).map((s) => s.photo_path as string),
    ...(staleMsg ?? []).map((s) => s.photo_path as string),
  ].filter(Boolean);

  let deletedPhotos = 0;
  if (paths.length > 0) {
    const { error: rmErr } = await supabaseAdmin.storage
      .from(VERIFICATION_BUCKET)
      .remove(paths);
    if (rmErr) {
      return NextResponse.json({ error: rmErr.message }, { status: 500 });
    }
    deletedPhotos = paths.length;

    const verIds = (staleVer ?? []).map((s) => s.id);
    const msgIds = (staleMsg ?? []).map((s) => s.id);
    if (verIds.length > 0)
      await supabaseAdmin
        .from("verifications")
        .update({ photo_path: null })
        .in("id", verIds);
    if (msgIds.length > 0)
      await supabaseAdmin
        .from("messages")
        .update({ photo_path: null })
        .in("id", msgIds);
  }

  // --- 2) prune old chat messages ---
  const chatCutoffTs = new Date(
    Date.now() - CHAT_RETENTION_DAYS * 86400_000
  ).toISOString();
  const { count: prunedChat } = await supabaseAdmin
    .from("messages")
    .delete({ count: "exact" })
    .eq("kind", "chat")
    .lt("created_at", chatCutoffTs);

  return NextResponse.json({
    ok: true,
    deletedPhotos,
    prunedChat: prunedChat ?? 0,
  });
}
