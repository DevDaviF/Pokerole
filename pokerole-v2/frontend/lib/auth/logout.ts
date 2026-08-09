"use client";

import { clearStoredToken } from "./session";
import { clearNavMode } from "@/lib/navigation/storage";

export function logoutAndRedirect() {
  clearStoredToken();
  clearNavMode();
  window.location.href = "/login";
}
