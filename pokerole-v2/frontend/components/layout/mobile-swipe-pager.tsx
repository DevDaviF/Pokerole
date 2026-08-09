"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getNavIndex, NAV_LINKS } from "./navLinks";

const THRESHOLD_RATIO = 0.22; // 22% da largura pra trocar
const VELOCITY_THRESHOLD = 0.35; // px/ms

type Props = {
  children: React.ReactNode;
};

export function MobileSwipePager({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const index = Math.max(0, getNavIndex(pathname));

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const widthRef = useRef(0);
  const indexRef = useRef(index);
  const startX = useRef(0);
  const startY = useRef(0);
  const startT = useRef(0);
  const dragRef = useRef(0);
  const axisRef = useRef<"x" | "y" | null>(null);
  const draggingRef = useRef(false);

  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  indexRef.current = index;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    if (!isMobile) return;
    const el = viewportRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      widthRef.current = w;
      setWidth(w);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);

  useEffect(() => {
    dragRef.current = 0;
    setDrag(0);
    setDragging(false);
    draggingRef.current = false;
    axisRef.current = null;
  }, [pathname]);

  useEffect(() => {
    if (!isMobile) return;
    const prev = NAV_LINKS[index - 1];
    const next = NAV_LINKS[index + 1];
    if (prev) router.prefetch(prev.href);
    if (next) router.prefetch(next.href);
  }, [index, isMobile, router]);

  const commit = useCallback(
    (nextIndex: number) => {
      const link = NAV_LINKS[nextIndex];
      if (!link || nextIndex === indexRef.current) {
        dragRef.current = 0;
        setDrag(0);
        setDragging(false);
        draggingRef.current = false;
        return;
      }
      router.push(link.href);
    },
    [router],
  );

  useEffect(() => {
    if (!isMobile) return;
    const el = viewportRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;

      draggingRef.current = true;
      axisRef.current = null;
      startX.current = e.clientX;
      startY.current = e.clientY;
      startT.current = performance.now();
      dragRef.current = 0;
      setDragging(true);
      setDrag(0);

      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;

      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;

      if (axisRef.current === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        axisRef.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (axisRef.current === "y") {
          // deixa o scroll vertical em paz
          draggingRef.current = false;
          setDragging(false);
          try {
            el.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          return;
        }
      }

      if (axisRef.current !== "x") return;

      e.preventDefault();

      const i = indexRef.current;
      const w = widthRef.current || 1;
      let next = dx;

      // resistência nas pontas
      if ((i === 0 && dx > 0) || (i === NAV_LINKS.length - 1 && dx < 0)) {
        next = dx * 0.35;
      }

      // limita um pouco além da largura
      next = Math.max(-w * 1.05, Math.min(w * 1.05, next));
      dragRef.current = next;
      setDrag(next);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!draggingRef.current && axisRef.current !== "x") {
        setDragging(false);
        return;
      }

      const dx = dragRef.current;
      const dt = Math.max(1, performance.now() - startT.current);
      const velocity = dx / dt; // px/ms
      const w = widthRef.current || 1;
      const i = indexRef.current;
      const passed =
        Math.abs(dx) > w * THRESHOLD_RATIO ||
        Math.abs(velocity) > VELOCITY_THRESHOLD;

      let nextIndex = i;
      if (axisRef.current === "x" && passed) {
        if (dx < 0 && i < NAV_LINKS.length - 1) nextIndex = i + 1;
        if (dx > 0 && i > 0) nextIndex = i - 1;
      }

      draggingRef.current = false;
      axisRef.current = null;
      setDragging(false);

      if (nextIndex !== i) {
        // anima até o slide vizinho antes/durante o push
        const dir = nextIndex > i ? -1 : 1;
        setDrag(dir * w);
        commit(nextIndex);
      } else {
        setDrag(0);
        dragRef.current = 0;
      }

      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [isMobile, commit]);

  if (isMobile === null) {
    return <div className="min-h-[calc(100dvh-7rem)]" />;
  }

  // Desktop: sem swiper
  if (!isMobile) {
    return <>{children}</>;
  }

  const w = width > 0 ? width : 1;
  const translateX = -index * w + drag;

  return (
    <div
      ref={viewportRef}
      className="relative w-full overflow-hidden"
      style={{
        // none = nós controlamos o gesto horizontal (efeito de swiper)
        touchAction: "none",
        minHeight: "calc(100dvh - 7rem)",
        cursor: dragging ? "grabbing" : "grab",
      }}
    >
      <div
        ref={trackRef}
        className="flex h-full will-change-transform"
        style={{
          width: w * NAV_LINKS.length,
          transform: `translate3d(${translateX}px, 0, 0)`,
          transition: dragging
            ? "none"
            : "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {NAV_LINKS.map((link, i) => {
          const active = i === index;
          return (
            <section
              key={link.href}
              className="h-full shrink-0"
              style={{ width: w }}
              aria-hidden={!active}
            >
              <div className="h-full min-h-[calc(100dvh-7rem)] w-full">
                {active ? (
                  (children ?? <SlidePlaceholder label={link.label} active />)
                ) : (
                  <SlidePlaceholder label={link.label} />
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SlidePlaceholder({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={
        active
          ? "text-muted-foreground flex min-h-[calc(100dvh-7rem)] items-start pt-2 text-sm"
          : "text-muted-foreground/50 flex min-h-[calc(100dvh-7rem)] items-center justify-center text-sm"
      }
    >
      {!active && label}
    </div>
  );
}
