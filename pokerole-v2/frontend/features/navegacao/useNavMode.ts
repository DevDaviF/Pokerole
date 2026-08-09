"use client";

import { useState, useEffect } from "react";
import { getNavMode, setNavMode, clearNavMode } from "@/lib/navigation/storage";
import type { Navmode } from "@/types/navigation";

export function useNavMode(){
    const [mode, setMode] = useState<Navmode | null>(null);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setMode(getNavMode());
        setHydrated(true);
    },  []);

    function saveMode(next: Navmode){
        setNavMode(next);
        setMode(next);
    }

    return {
        mode,
        hydrated,
        saveMode,
        needsSelection: hydrated && mode === null,
    };
}