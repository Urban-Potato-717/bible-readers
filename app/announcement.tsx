"use client";

import { useEffect, useState } from "react";

// Bump the version (and the items) whenever there's a new feature to announce;
// users who dismissed an older version will see the new one once.
const SEEN_KEY = "announcement-seen-v2";

const FEATURES = [
  { icon: "🌙", title: "다크 모드", desc: "어두운 테마를 지원해요." },
  {
    icon: "⚙️",
    title: "설정 탭",
    desc: "다크 모드와 알림을 직접 켜고 끌 수 있어요.",
  },
  {
    icon: "🔥",
    title: "연속 인증 스트릭",
    desc: "며칠 연속 인증했는지 채팅방 상단에 표시돼요.",
  },
  {
    icon: "🔔",
    title: "저녁 인증 리마인더",
    desc: "저녁 9시까지 인증 전이면 알림으로 알려드려요.",
  },
];

export function Announcement() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return;
    // Reveal after mount (not synchronously) so SSR and first paint match.
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function close() {
    localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 p-3">
      <div className="w-full sm:max-w-sm bg-white rounded-2xl p-5 shadow-lg dark:bg-slate-900 dark:text-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🎉</span>
          <h2 className="font-bold text-lg">새로운 기능</h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          앱에 새로운 기능이 추가되었어요.
        </p>
        <ul className="space-y-3 mb-5">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-3">
              <span className="text-xl leading-none">{f.icon}</span>
              <div>
                <p className="text-sm font-medium">{f.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {f.desc}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <button
          onClick={close}
          className="w-full rounded-lg bg-slate-900 text-white py-2.5 text-sm font-medium dark:bg-slate-100 dark:text-slate-900"
        >
          확인
        </button>
      </div>
    </div>
  );
}
