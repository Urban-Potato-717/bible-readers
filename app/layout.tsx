import type { Metadata, Viewport } from "next";
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

// Applies only an explicitly saved theme before first paint to avoid a flash.
// We intentionally ignore the OS color scheme so the default is always light
// and the toggle is the single source of truth.
const themeScript = `(function(){try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
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
