import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { REACTION_EMOJIS } from "@/lib/chat";

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const messageId = body?.messageId as string | undefined;
  const emoji = body?.emoji as string | undefined;

  if (!messageId || !emoji || !REACTION_EMOJIS.includes(emoji as never)) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", me.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin.from("reactions").delete().eq("id", existing.id);
  } else {
    const { error } = await supabaseAdmin
      .from("reactions")
      .insert({ message_id: messageId, user_id: me.id, emoji });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
