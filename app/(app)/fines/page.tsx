import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function FinesPage() {
  const me = (await getSessionUser())!;

  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, name, legacy_paid_total")
    .order("name");

  const { data: fines } = await supabaseAdmin
    .from("fines")
    .select("user_id, amount, status");

  type Row = {
    id: string;
    name: string;
    paidTotal: number;
    pendingTotal: number;
    isMe: boolean;
  };

  const rows: Row[] = (users ?? []).map((u) => {
    const userFines = (fines ?? []).filter((f) => f.user_id === u.id);
    const paid =
      (u.legacy_paid_total ?? 0) +
      userFines.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0);
    const pending = userFines
      .filter((f) => f.status === "pending")
      .reduce((s, f) => s + f.amount, 0);
    return {
      id: u.id,
      name: u.name,
      paidTotal: paid,
      pendingTotal: pending,
      isMe: u.id === me.id,
    };
  });

  rows.sort((a, b) => b.paidTotal + b.pendingTotal - (a.paidTotal + a.pendingTotal));

  const totalConfirmed = rows.reduce((s, r) => s + r.paidTotal, 0);
  const totalPending = rows.reduce((s, r) => s + r.pendingTotal, 0);

  return (
    <main className="max-w-md mx-auto px-4 py-6">
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white p-5 mb-6">
        <p className="text-xs text-slate-300">태초부터 시작된 총 벌금</p>
        <p className="text-3xl font-bold mt-1">
          {totalConfirmed.toLocaleString()}원
        </p>
        <p className="text-xs text-slate-300 mt-2">
          기록 중입니다
          {totalPending > 0 && (
            <span className="ml-2">
              · 미정산 {totalPending.toLocaleString()}원
            </span>
          )}
        </p>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-6 dark:bg-slate-900 dark:border-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">벌금 납부처</p>
        <p className="font-mono text-sm">3333-29-4006351 카카오뱅크</p>
        <p className="text-sm text-slate-700 dark:text-slate-300">예금주: 김준영</p>
      </div>

      <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">개인별 현황</h2>
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className={`rounded-xl border p-3 flex items-center justify-between ${
              r.isMe
                ? "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-900"
                : "bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800"
            }`}
          >
            <div>
              <p className="font-medium">
                {r.name}
                {r.isMe && (
                  <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">나</span>
                )}
              </p>
              {r.pendingTotal > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  미정산 {r.pendingTotal.toLocaleString()}원
                </p>
              )}
            </div>
            <p className="text-lg font-bold">
              {r.paidTotal.toLocaleString()}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">원</span>
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
