"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  names: { name: string; needsSetup: boolean }[];
};

export function LoginForm({ names }: Props) {
  const router = useRouter();
  const [name, setName] = useState(names[0]?.name ?? "");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = names.find((n) => n.name === name);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "로그인 실패");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">이름</label>
        <select
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {names.map((n) => (
            <option key={n.name} value={n.name}>
              {n.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          PIN (4자리)
          {selected?.needsSetup && (
            <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
              첫 로그인 — 원하는 PIN을 정해주세요
            </span>
          )}
        </label>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{4}"
          maxLength={4}
          required
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 tracking-[0.5em] text-center text-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          placeholder="••••"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 dark:text-red-300 dark:bg-red-950 dark:border-red-900">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || pin.length !== 4}
        className="w-full rounded-lg bg-slate-900 text-white py-3 font-medium disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        {loading ? "확인 중..." : selected?.needsSetup ? "PIN 등록하고 시작" : "로그인"}
      </button>
    </form>
  );
}
