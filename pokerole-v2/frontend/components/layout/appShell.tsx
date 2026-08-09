"use client";

import { useEffect, useState } from "react";
import { NavModeModal } from "@/features/navegacao/navModeModal";
import { useNavMode } from "@/features/navegacao/useNavMode";
import { logoutAndRedirect } from "@/lib/auth/logout";
import { NavSidebar } from "./navSidebar";
import { NavTop } from "./navTop";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { mode, hydrated, saveMode, needsSelection } = useNavMode();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (!hydrated) {
    return <div className="bg-background min-h-dvh" />;
  }

  // Modal de escolha só no desktop
  const modalOpen = isDesktop && (needsSelection || settingsOpen);

  function handleConfirm(next: "top" | "sidebar") {
    saveMode(next);
    setSettingsOpen(false);
  }

  function handleDismiss() {
    if (needsSelection) {
      logoutAndRedirect();
      return;
    }
    setSettingsOpen(false);
  }

  const shellProps = {
    onChangeNavMode: isDesktop ? () => setSettingsOpen(true) : undefined,
  };

  return (
    <>
      <NavModeModal
        open={modalOpen}
        onConfirm={handleConfirm}
        allowDismiss
        onDismiss={handleDismiss}
        initialMode={mode}
      />

      {mode === "sidebar" && isDesktop ? (
        <NavSidebar {...shellProps}>{children}</NavSidebar>
      ) : (
        <NavTop {...shellProps}>{children}</NavTop>
      )}
    </>
  );
}
