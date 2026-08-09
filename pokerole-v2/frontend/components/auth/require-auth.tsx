"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredToken } from "@/lib/auth/session";

/** Redireciona se a sessão sumir (cookie/localStorage). */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function ensureSession() {
      if (!getStoredToken()) {
        router.replace("/login");
        return false;
      }
      return true;
    }

    // pequena folga pra ler storage após hard redirect
    const start = window.setTimeout(() => {
      if (ensureSession()) setReady(true);
    }, 0);

    const interval = window.setInterval(ensureSession, 3000);
    window.addEventListener("focus", ensureSession);
    document.addEventListener("visibilitychange", ensureSession);

    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
      window.removeEventListener("focus", ensureSession);
      document.removeEventListener("visibilitychange", ensureSession);
    };
  }, [router]);

  if (!ready) {
    return <div className="bg-background min-h-dvh" />;
  }

  return <>{children}</>;
}
