"use client";

import { useEffect, useState } from "react";
import { getNavMode, setNavMode } from "@/lib/navigation/storage";
import type { Navmode } from "@/types/navigation";

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

export function useNavMode() {
  const [mode, setMode] = useState<Navmode | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = getNavMode();

    // Mobile: sem escolha de navegação — usa sempre o modo top (swiper)
    if (isMobileViewport()) {
      const mobileMode: Navmode = "top";
      if (stored !== mobileMode) setNavMode(mobileMode);
      setMode(mobileMode);
      setHydrated(true);
      return;
    }

    setMode(stored);
    setHydrated(true);
  }, []);

  function saveMode(next: Navmode) {
    setNavMode(next);
    setMode(next);
  }

  return {
    mode,
    hydrated,
    saveMode,
    // Modal só no desktop e só se ainda não escolheu
    needsSelection: hydrated && mode === null && !isMobileViewport(),
  };
}
