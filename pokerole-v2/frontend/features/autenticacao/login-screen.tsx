"use client";

import { useEffect, useState } from "react";
import { setStoredToken } from "@/lib/auth/session";
import { LoginMobile } from "./login-mobile";
import { LoginDesktop } from "./login-desktop";

export type LoginViewProps = {
  email: string;
  password: string;
  showPassword: boolean;
  keepConnected: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onKeepConnectedChange: (value: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepConnected, setKeepConnected] = useState(true);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStoredToken("dev-token");
    window.location.href = "/dashboard";
  }

  const sharedProps: LoginViewProps = {
    email,
    password,
    showPassword,
    keepConnected,
    onEmailChange: setEmail,
    onPasswordChange: setPassword,
    onTogglePassword: () => setShowPassword((v) => !v),
    onKeepConnectedChange: setKeepConnected,
    onSubmit: handleSubmit,
  };

  // Evita SSR com ThemeToggle / dois layouts ao mesmo tempo
  if (isMobile === null) {
    return <div className="bg-background min-h-dvh" />;
  }

  return isMobile ? (
    <LoginMobile {...sharedProps} />
  ) : (
    <LoginDesktop {...sharedProps} />
  );
}
