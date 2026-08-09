import { AUTH_COOKIE_NAME } from "./constants";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export { AUTH_COOKIE_NAME };
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split("; ");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    if (key === name) {
      const value = decodeURIComponent(part.slice(eq + 1));
      return value || null;
    }
  }
  return null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

/** Sessão no cookie (middleware) + localStorage (client). */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;

  const fromLocal = localStorage.getItem(AUTH_COOKIE_NAME);
  if (fromLocal) {
    if (!readCookie(AUTH_COOKIE_NAME)) {
      writeCookie(AUTH_COOKIE_NAME, fromLocal, COOKIE_MAX_AGE);
    }
    return fromLocal;
  }

  const fromCookie = readCookie(AUTH_COOKIE_NAME);
  if (fromCookie) {
    localStorage.setItem(AUTH_COOKIE_NAME, fromCookie);
    return fromCookie;
  }

  return null;
}

export function setStoredToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_COOKIE_NAME, token);
  writeCookie(AUTH_COOKIE_NAME, token, COOKIE_MAX_AGE);
}

export function clearStoredToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_COOKIE_NAME);
  writeCookie(AUTH_COOKIE_NAME, "", 0);
}
