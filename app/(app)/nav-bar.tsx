"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth";

export function NavBar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();

  const tabs = [
    { href: "/", label: "채팅방" },
    { href: "/calendar", label: "캘린더" },
    { href: "/fines", label: "벌금" },
    { href: "/settings", label: "설정" },
    ...(user.is_admin ? [{ href: "/admin", label: "관리" }] : []),
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
      <div className="max-w-md mx-auto px-4 pt-3 pb-0 flex items-center justify-between">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {user.name}
          </span>
          <span className="mx-1">·</span>
          성경 읽기방
        </div>
        <button
          onClick={logout}
          className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          로그아웃
        </button>
      </div>
      <nav className="max-w-md mx-auto px-4 flex gap-1 mt-2">
        {tabs.map((t) => {
          const active =
            t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-3 py-2 text-sm border-b-2 transition-colors ${
                active
                  ? "border-slate-900 text-slate-900 font-medium dark:border-slate-100 dark:text-slate-100"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
