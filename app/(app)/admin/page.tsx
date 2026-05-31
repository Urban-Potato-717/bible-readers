import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { AdminUserRow } from "./admin-user-row";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = (await getSessionUser())!;
  if (!me.is_admin) redirect("/");

  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, name")
    .order("name");

  const { data: pendingFines } = await supabaseAdmin
    .from("fines")
    .select("id, user_id, date, amount, note")
    .eq("status", "pending")
    .order("date", { ascending: false });

  const grouped = (users ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    pending: (pendingFines ?? []).filter((f) => f.user_id === u.id),
  }));

  const filtered = grouped.filter((g) => g.pending.length > 0);

  return (
    <main className="max-w-md mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-1">정산 관리</h1>
      <p className="text-sm text-slate-500 mb-6">
        입금이 확인된 벌금을 &lsquo;납부 완료&rsquo;로 표시하세요. 납부 처리 시 총 벌금에 반영됩니다.
      </p>

      {filtered.length === 0 ? (
        <p className="text-center text-slate-500 py-12">미정산 벌금이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((g) => (
            <AdminUserRow key={g.id} name={g.name} fines={g.pending} />
          ))}
        </div>
      )}
    </main>
  );
}
