import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { Pwa } from "./pwa";

// Run server functions in Seoul (icn1) to colocate with the Supabase DB.
export const preferredRegion = "icn1";

export const metadata: Metadata = {
  title: "성경 읽기방",
  description: "매일 성경 인증 + 벌금 자동 정산",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "성경 읽기방",
  },
};

export const viewport: Viewport = {
  themeColor: "#f8fafc",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

// Reconciles the theme on the client for cached/offline shells where the
// server-rendered class may be stale. The cookie is the source of truth; we
// fall back to localStorage. The OS color scheme is intentionally ignored so
// the default is always light and the toggle is the single source of truth.
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=(dark|light)/);var t=m?m[1]:localStorage.getItem('theme');var c=document.documentElement.classList;if(t==='dark')c.add('dark');else if(t==='light')c.remove('dark');}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Server-render the theme from the cookie so installed PWAs (whose
  // localStorage can be isolated/evicted across cold launches) keep dark mode.
  const dark = (await cookies()).get("theme")?.value === "dark";

  return (
    <html
      lang="ko"
      className={`h-full antialiased${dark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col">
        {children}
        <Pwa />
      </body>
    </html>
  );
}
