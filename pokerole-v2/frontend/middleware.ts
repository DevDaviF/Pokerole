import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";

const AUTH_PAGES = ["/login", "/criar-conta"];
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/clientes",
  "/relatorios",
  "/meus-pokemon",
  "/meu-time",
];

function isAuthPage(pathname: string) {
  return AUTH_PAGES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (isProtected(pathname) && !token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (isAuthPage(pathname) && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/clientes/:path*",
    "/relatorios/:path*",
    "/meus-pokemon/:path*",
    "/meu-time/:path*",
    "/login",
    "/criar-conta",
  ],
};
