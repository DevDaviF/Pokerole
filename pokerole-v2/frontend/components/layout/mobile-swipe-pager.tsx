"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getNavIndex, NAV_LINKS } from "./navLinks";

const SWIPE_THRESHOLD = 40;

type Props = {
  children: React.ReactNode;
};

/**
 * Navegação por gesto horizontal (estilo Meta):
 * - arrastar pra esquerda → próxima aba
 * - arrastar pra direita → aba anterior
 */
export function MobileSwipePager({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const index = Math.max(0, getNavIndex(pathname));

  const rootRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const deltaX = useRef(0);
  const axis = useRef<"x" | "y" | null>(null);
  const active = useRef(false);
  const indexRef = useRef(index);

  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  indexRef.current = index;

  const goTo = useCallback(
    (nextIndex: number) => {
      const link = NAV_LINKS[nextIndex];
      if (!link) return;
      router.push(link.href);
    },
    [router],
  );

  useEffect(() => {
    setDragX(0);
    setIsDragging(false);
    active.current = false;
    axis.current = null;
    deltaX.current = 0;
  }, [pathname]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const isMobile = () => window.matchMedia("(max-width: 767px)").matches;

    const onStart = (x: number, y: number) => {
      if (!isMobile()) return;
      active.current = true;
      startX.current = x;
      startY.current = y;
      deltaX.current = 0;
      axis.current = null;
      setIsDragging(true);
      setDragX(0);
    };

    const onMove = (x: number, y: number, e: Event) => {
      if (!active.current || !isMobile()) return;

      const dx = x - startX.current;
      const dy = y - startY.current;

      if (axis.current === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        axis.current = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      }

      // scroll vertical da página — não interfere
      if (axis.current === "y") return;

      // gesto horizontal nosso
      e.preventDefault();
      deltaX.current = dx;
      setDragX(dx);
    };

    const onEnd = () => {
      if (!active.current) return;

      const dx = deltaX.current;
      const i = indexRef.current;

      if (axis.current === "x") {
        // direita → anterior | esquerda → próximo
        if (dx > SWIPE_THRESHOLD && i > 0) {
          goTo(i - 1);
        } else if (dx < -SWIPE_THRESHOLD && i < NAV_LINKS.length - 1) {
          goTo(i + 1);
        }
      }

      active.current = false;
      axis.current = null;
      deltaX.current = 0;
      setDragX(0);
      setIsDragging(false);
    };

    const touchStart = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      onStart(t.clientX, t.clientY);
    };
    const touchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      onMove(t.clientX, t.clientY, e);
    };
    const mouseDown = (e: MouseEvent) => {
      if (!isMobile()) return;
      onStart(e.clientX, e.clientY);
    };
    const mouseMove = (e: MouseEvent) => {
      if (!active.current) return;
      onMove(e.clientX, e.clientY, e);
    };
    const mouseUp = () => onEnd();

    el.addEventListener("touchstart", touchStart, { passive: true });
    el.addEventListener("touchmove", touchMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);

    // DevTools / emulador com mouse
    el.addEventListener("mousedown", mouseDown);
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("mouseup", mouseUp);

    return () => {
      el.removeEventListener("touchstart", touchStart);
      el.removeEventListener("touchmove", touchMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("mousedown", mouseDown);
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("mouseup", mouseUp);
    };
  }, [goTo]);

  useEffect(() => {
    const i = Math.max(0, getNavIndex(pathname));
    const prev = NAV_LINKS[i - 1];
    const next = NAV_LINKS[i + 1];
    if (prev) router.prefetch(prev.href);
    if (next) router.prefetch(next.href);
  }, [pathname, router]);

  return (
    <div
      ref={rootRef}
      className="relative min-h-[calc(100dvh-7rem)] overflow-hidden md:min-h-0"
      style={{ touchAction: "pan-y" }}
    >
      <div
        className="min-h-[inherit]"
        style={{
          transform: `translate3d(${dragX}px, 0, 0)`,
          transition: isDragging ? "none" : "transform 200ms ease-out",
        }}
      >
        {children ?? (
          // garante área de toque mesmo com página vazia
          <div className="min-h-[calc(100dvh-7rem)] w-full" aria-hidden />
        )}
      </div>
    </div>
  );
}
