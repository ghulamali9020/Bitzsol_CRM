import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import type { AuthUser } from "@/types";

const JWT_SECRET = process.env.JWT_SECRET ?? "bitzsol-crm-secret";
const COOKIE_NAME = "crm_session";

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function setSessionCookie(token: string): { name: string; value: string; httpOnly: boolean; maxAge: number; path: string; sameSite: "lax" } {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
    sameSite: "lax",
  };
}

export function clearSessionCookie(): { name: string; value: string; maxAge: number; path: string } {
  return {
    name: COOKIE_NAME,
    value: "",
    maxAge: 0,
    path: "/",
  };
}
