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
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="h-dvh bg-slate-50 text-slate-900 flex flex-col">
        {children}
        <Pwa />
      </body>
    </html>
  );
}
