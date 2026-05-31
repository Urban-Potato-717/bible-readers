import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export const preferredRegion = "icn1";

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
