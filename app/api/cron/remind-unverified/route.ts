import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { currentReadingDate } from "@/lib/dates";
import { assertCronAuth } from "@/lib/cron";
import { sendToUsers } from "@/lib/push";

export const preferredRegion = "icn1";

// 리마인더 문구 후보. 날짜로 인덱스를 정해 그날은 전원 같은 문구가 가고,
// 날마다 순환한다(랜덤 아님 — 멤버 간 일관성 유지).
const REMINDERS = [
  {
    title: "오늘 성경 읽었나요? 📖",
    body: "아직 오늘 인증 전이에요. 자기 전에 잊지 말고 인증해요!",
  },
  {
    title: "잠깐, 오늘 읽었나? 📖",
    body: "아직 인증이 없어요. 한 장이라도 읽고 인증 남겨요!",
  },
  {
    title: "벌금 1,000원 째깍째깍 ⏰",
    body: "오늘 미인증이면 자정에 벌금이에요. 지금 인증해요!",
  },
  {
    title: "연속 기록 지키기 🔥",
    body: "오늘만 인증하면 연속 기록이 이어져요. 까먹기 전에 한 번!",
  },
];

/** YYYY-MM-DD를 에폭 일수로 바꿔 문구를 결정 — 같은 날은 항상 같은 문구 */
function reminderForDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dayIndex = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return REMINDERS[((dayIndex % REMINDERS.length) + REMINDERS.length) % REMINDERS.length];
}

// 매일 KST 저녁 9시 (UTC 12:00) 실행.
// 오늘 아직 인증 안 한 사람에게만 리마인더 푸시(인증한 사람·푸시 끈 사람은 제외).
export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const today = currentReadingDate();

  const [{ data: users }, { data: verifications }] = await Promise.all([
    supabaseAdmin.from("users").select("id"),
    supabaseAdmin.from("verifications").select("user_id").eq("date", today),
  ]);

  const verifiedIds = new Set((verifications ?? []).map((v) => v.user_id));
  const targets = (users ?? [])
    .filter((u) => !verifiedIds.has(u.id))
    .map((u) => u.id);

  const reminder = reminderForDate(today);
  if (targets.length > 0) {
    await sendToUsers(targets, { ...reminder, url: "/" });
  }

  return NextResponse.json({
    ok: true,
    date: today,
    reminded: targets.length,
    title: reminder.title,
  });
}
