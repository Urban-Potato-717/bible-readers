"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Fine = {
  id: string;
  date: string;
  amount: number;
  note: string | null;
};

function krDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

export function AdminUserRow({
  userId,
  name,
  fines,
}: {
  userId: string;
  name: string;
  fines: Fine[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(fines.map((f) => f.id))
  );
  const [pending, startTransition] = useTransition();
  const [verifyingDate, setVerifyingDate] = useState<string | null>(null);
  const [confirmDate, setConfirmDate] = useState<string | null>(null);

  const total = fines
    .filter((f) => selected.has(f.id))
    .reduce((s, f) => s + f.amount, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function markPaid() {
    if (selected.size === 0) return;
    startTransition(async () => {
      const res = await fetch("/api/admin/mark-paid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fineIds: Array.from(selected) }),
      });
      if (res.ok) router.refresh();
    });
  }

  // Quiet correction: mark this single day verified and drop its fine.
  async function markVerified(date: string) {
    setConfirmDate(null);
    setVerifyingDate(date);
    const res = await fetch("/api/admin/mark-verified", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, date }),
    });
    setVerifyingDate(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-medium">{name}</p>
        <p className="text-sm text-slate-600">
          선택 {total.toLocaleString()}원 / 총{" "}
          {fines.reduce((s, f) => s + f.amount, 0).toLocaleString()}원
        </p>
      </div>
      <div className="space-y-1 mb-3">
        {fines.map((f) => (
          <div key={f.id} className="rounded hover:bg-slate-50">
            <div className="flex items-center gap-3 text-sm py-1.5 px-2">
              <label className="flex items-center gap-3 flex-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(f.id)}
                  onChange={() => toggle(f.id)}
                  className="accent-slate-900"
                />
                <span className="flex-1">{f.date}</span>
                <span className="text-slate-600">
                  {f.amount.toLocaleString()}원
                </span>
                {f.note && (
                  <span className="text-xs text-slate-400">({f.note})</span>
                )}
              </label>
              <button
                onClick={() => setConfirmDate(f.date)}
                disabled={verifyingDate === f.date}
                className="shrink-0 rounded-md border border-slate-300 text-slate-700 px-2 py-1 text-xs font-medium hover:bg-slate-100 disabled:opacity-50"
              >
                {verifyingDate === f.date ? "처리 중..." : "인증 처리"}
              </button>
            </div>
            {confirmDate === f.date && (
              <div className="flex items-center gap-2 px-2 pb-2 text-xs">
                <span className="flex-1 text-slate-600">
                  {krDate(f.date)} {name}님의 내역을 인증 처리하시겠습니까?
                </span>
                <button
                  onClick={() => markVerified(f.date)}
                  className="shrink-0 rounded-md bg-slate-900 text-white px-3 py-1 font-medium"
                >
                  네
                </button>
                <button
                  onClick={() => setConfirmDate(null)}
                  className="shrink-0 rounded-md border border-slate-300 text-slate-700 px-3 py-1"
                >
                  아니요
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={markPaid}
        disabled={pending || selected.size === 0}
        className="w-full rounded-lg bg-emerald-600 text-white py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "처리 중..." : "선택 항목 납부 완료 처리"}
      </button>
    </div>
  );
}
