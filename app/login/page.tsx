import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const me = await getSessionUser();
  if (me) redirect("/");

  const { data: users } = await supabaseAdmin
    .from("users")
    .select("name, pin_hash")
    .order("name");

  const names = (users ?? []).map((u) => ({
    name: u.name as string,
    needsSetup: !u.pin_hash,
  }));

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-1">성경 읽기방</h1>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-8">
          매일 인증 · 새벽 1시 컷 · 1,000원
        </p>
        <LoginForm names={names} />
      </div>
    </main>
  );
}
