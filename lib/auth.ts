import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "./supabase";

const COOKIE_NAME = "bible_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60일

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET is not set or too short");
  }
  return s;
}

function sign(value: string): string {
  const mac = createHmac("sha256", getSecret()).update(value).digest("base64url");
  return `${value}.${mac}`;
}

function verify(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = createHmac("sha256", getSecret()).update(value).digest("base64url");
  try {
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
    return value;
  } catch {
    return null;
  }
}

export async function setSession(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export type SessionUser = {
  id: string;
  name: string;
  is_admin: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const userId = verify(raw);
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, name, is_admin")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return data as SessionUser;
}
