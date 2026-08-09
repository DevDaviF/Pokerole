"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // mock por enquanto
    setStoredToken("dev-token");
    router.push("/dashboard");
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

  return (
    <div className="min-h-dvh">
      <div className="md:hidden">
        <RegisterMobile {...sharedProps} />
      </div>
      <div className="hidden md:block">
        <RegisterDesktop {...sharedProps} />
      </div>
    </div>
  );
}
