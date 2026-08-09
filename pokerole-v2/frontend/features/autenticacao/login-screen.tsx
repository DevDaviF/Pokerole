"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepConnected, setKeepConnected] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStoredToken("dev-token");
    router.push("/dashboard");
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

  return (
    <div className="min-h-dvh">
      <div className="md:hidden">
        <LoginMobile {...sharedProps} />
      </div>
      <div className="hidden md:block">
        <LoginDesktop {...sharedProps} />
      </div>
    </div>
  );
}
