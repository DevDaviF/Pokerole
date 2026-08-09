"use client";

import { useEffect, useState } from "react";
import { setStoredToken } from "@/lib/auth/session";
import { RegisterMobile } from "./register-mobile";
import { RegisterDesktop } from "./register-desktop";

export type RegisterViewProps = {
  username: string;
  email: string;
  password: string;
  showPassword: boolean;
  onUsernameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function RegisterScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const sharedProps: RegisterViewProps = {
    username,
    email,
    password,
    showPassword,
    onUsernameChange: setUsername,
    onEmailChange: setEmail,
    onPasswordChange: setPassword,
    onTogglePassword: () => setShowPassword((v) => !v),
    onSubmit: handleSubmit,
  };

  if (isMobile === null) {
    return <div className="bg-background min-h-dvh" />;
  }

  return isMobile ? (
    <RegisterMobile {...sharedProps} />
  ) : (
    <RegisterDesktop {...sharedProps} />
  );
}
