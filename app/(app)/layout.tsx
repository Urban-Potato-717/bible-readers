import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { NavBar } from "./nav-bar";
import { PushOptin } from "../push-optin";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  return (
    <div className="h-full flex flex-col min-h-0">
      <NavBar user={me} />
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      <PushOptin />
    </div>
  );
}
