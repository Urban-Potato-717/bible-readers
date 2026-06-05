import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { currentReadingDate, shiftDate } from "@/lib/dates";
import { currentStreak } from "@/lib/streak";
import { loadFeed } from "@/lib/messages";
import { ChatRoom } from "./chat-room";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const me = (await getSessionUser())!;
  const today = currentReadingDate();

  const [initial, { data: myVerifications }] = await Promise.all([
    loadFeed({ meId: me.id }),
    supabaseAdmin
      .from("verifications")
      .select("date")
      .eq("user_id", me.id)
      .gte("date", shiftDate(today, -400)),
  ]);

  const dates = (myVerifications ?? []).map((v) => v.date as string);

  return (
    <ChatRoom
      meId={me.id}
      today={today}
      initialMessages={initial}
      verifiedToday={dates.includes(today)}
      streak={currentStreak(dates, today)}
    />
  );
}
