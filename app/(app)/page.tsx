import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { currentReadingDate } from "@/lib/dates";
import { loadFeed } from "@/lib/messages";
import { ChatRoom } from "./chat-room";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const me = (await getSessionUser())!;
  const today = currentReadingDate();

  const [initial, { data: myVerification }] = await Promise.all([
    loadFeed({ meId: me.id }),
    supabaseAdmin
      .from("verifications")
      .select("id")
      .eq("user_id", me.id)
      .eq("date", today)
      .maybeSingle(),
  ]);

  return (
    <ChatRoom
      meId={me.id}
      today={today}
      initialMessages={initial}
      verifiedToday={!!myVerification}
    />
  );
}
