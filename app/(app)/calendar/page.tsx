import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { currentReadingDate } from "@/lib/dates";

type SearchParams = Promise<{ view?: string; month?: string }>;

function parseMonth(input?: string): { year: number; month: number } {
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    const [y, m] = input.split("-").map(Number);
    return { year: y, month: m };
  }
  const today = currentReadingDate();
  const [y, m] = today.split("-").map(Number);
  return { year: y, month: m };
}

function monthShift(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const me = (await getSessionUser())!;
  const sp = await searchParams;
  const view = sp.view === "group" ? "group" : "personal";
  const { year, month } = parseMonth(sp.month);
  const today = currentReadingDate();

  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth(year, month)).padStart(2, "0")}`;

  const [{ data: users }, verResult, fineResult] = await Promise.all([
    supabaseAdmin.from("users").select("id, name").order("name"),
    supabaseAdmin
      .from("verifications")
      .select("user_id, date")
      .gte("date", firstDay)
      .lte("date", lastDay),
    supabaseAdmin
      .from("fines")
      .select("user_id, date, status")
      .gte("date", firstDay)
      .lte("date", lastDay),
  ]);

  const verifications = verResult.data ?? [];
  const fines = fineResult.data ?? [];
  const userCount = users?.length ?? 0;

  // Build day → status maps
  const personalVer = new Set(
    verifications.filter((v) => v.user_id === me.id).map((v) => v.date)
  );
  const personalFine = new Set(
    fines.filter((f) => f.user_id === me.id).map((f) => f.date)
  );
  const groupVerCount = new Map<string, number>();
  for (const v of verifications) {
    groupVerCount.set(v.date, (groupVerCount.get(v.date) ?? 0) + 1);
  }

  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });

  // 첫째 날 요일 (일=0)
  const firstWeekday = new Date(year, month - 1, 1).getDay();

  const prev = monthShift(year, month, -1);
  const next = monthShift(year, month, 1);
  const curMonthStr = `${year}-${String(month).padStart(2, "0")}`;

  return (
    <main className="max-w-md mx-auto px-4 py-6">
      <div className="flex gap-1 mb-4">
        <Link
          href={`/calendar?view=personal&month=${curMonthStr}`}
          className={`flex-1 text-center text-sm py-2 rounded-lg border ${
            view === "personal"
              ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
              : "bg-white border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          }`}
        >
          내 기록
        </Link>
        <Link
          href={`/calendar?view=group&month=${curMonthStr}`}
          className={`flex-1 text-center text-sm py-2 rounded-lg border ${
            view === "group"
              ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
              : "bg-white border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          }`}
        >
          전체
        </Link>
      </div>

      <div className="flex items-center justify-between mb-3">
        <Link
          href={`/calendar?view=${view}&month=${prev}`}
          className="text-slate-600 px-3 py-1 rounded hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ←
        </Link>
        <p className="font-medium">
          {year}년 {month}월
        </p>
        <Link
          href={`/calendar?view=${view}&month=${next}`}
          className="text-slate-600 px-3 py-1 rounded hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          →
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 dark:text-slate-400 mb-1">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((date) => {
          const dayNum = parseInt(date.slice(-2), 10);
          const isFuture = date > today;
          const isToday = date === today;

          let cellClass =
            "aspect-square flex flex-col items-center justify-center rounded-lg text-xs border ";
          let content: React.ReactNode = null;

          if (view === "personal") {
            const verified = personalVer.has(date);
            const fined = personalFine.has(date);
            if (verified) {
              cellClass +=
                "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300";
              content = "✓";
            } else if (fined) {
              cellClass +=
                "bg-red-50 border-red-300 text-red-700 dark:bg-red-950 dark:border-red-900 dark:text-red-300";
              content = "✕";
            } else if (isFuture) {
              cellClass +=
                "bg-white border-slate-100 text-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-600";
            } else {
              cellClass +=
                "bg-white border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500";
            }
          } else {
            const count = groupVerCount.get(date) ?? 0;
            if (isFuture) {
              cellClass +=
                "bg-white border-slate-100 text-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-600";
            } else if (count === userCount) {
              cellClass +=
                "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900 dark:border-emerald-700 dark:text-emerald-200";
            } else if (count > 0) {
              cellClass +=
                "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-300";
            } else {
              cellClass +=
                "bg-red-50 border-red-200 text-red-600 dark:bg-red-950 dark:border-red-900 dark:text-red-400";
            }
            if (!isFuture && userCount > 0) {
              content = (
                <span className="text-[10px] mt-0.5">
                  {count}/{userCount}
                </span>
              );
            }
          }

          if (isToday) cellClass += " ring-2 ring-slate-900 dark:ring-slate-100";

          return (
            <div key={date} className={cellClass}>
              <span className="text-sm font-medium">{dayNum}</span>
              {content && <div className="mt-0.5">{content}</div>}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 text-center">
        {view === "personal" ? "✓ 인증 완료 · ✕ 미인증(벌금)" : "전체 인증 수 / 총 인원"}
      </p>
    </main>
  );
}
