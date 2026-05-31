"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  date: string;
  reupload?: boolean;
};

export function VerifyForm({ date, reupload }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!text.trim() && !file) {
      setError("읽은 장을 적거나, 사진을 한 장 올려주세요");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("date", date);
      fd.set("text", text);
      if (file) fd.set("photo", file);
      const res = await fetch("/api/verify", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "인증 실패");
        return;
      }
      setText("");
      setFile(null);
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
        <label className="block text-sm font-medium mb-1">읽은 장</label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: 창세기 1-3장"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">사진 (선택)</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-slate-700 hover:file:bg-slate-200"
        />
        {file && (
          <p className="text-xs text-slate-500 mt-1">
            선택됨: {file.name} ({Math.round(file.size / 1024)}KB)
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-slate-900 text-white py-3 font-medium disabled:opacity-50"
      >
        {loading ? "올리는 중..." : reupload ? "다시 인증" : "인증하기"}
      </button>
    </form>
  );
}
