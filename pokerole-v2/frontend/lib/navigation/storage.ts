import { NAV_MODE_STORAGE_KEY, type Navmode } from "@/types/navigation";

export function getNavMode(): Navmode | null {
    if (typeof window === "undefined") return null;
    const value =  localStorage.getItem(NAV_MODE_STORAGE_KEY);
    return value === "top" || value === "sidebar" ? value as Navmode : null;
}

export function setNavMode(mode: Navmode) {
    localStorage.setItem(NAV_MODE_STORAGE_KEY, mode);
}

export function clearNavMode() {
    localStorage.removeItem(NAV_MODE_STORAGE_KEY);
}