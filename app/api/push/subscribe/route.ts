import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const preferredRegion = "icn1";

type SubBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { endpoint, keys } = (await req.json().catch(() => ({}))) as SubBody;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "구독 정보가 올바르지 않습니다" }, { status: 400 });
  }

  // endpoint is unique per device; re-subscribing (or switching account on the
  // same device) overwrites the owning user.
  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    { user_id: me.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    { onConflict: "endpoint" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { endpoint } = (await req.json().catch(() => ({}))) as SubBody;
  if (!endpoint) return NextResponse.json({ error: "endpoint 필요" }, { status: 400 });

  await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
