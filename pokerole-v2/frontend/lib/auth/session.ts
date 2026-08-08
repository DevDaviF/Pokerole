export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pokerole_token");
}

export function setStoredToken(token: string) {
  localStorage.setItem("pokerole_token", token);
}

export function clearStoredToken() {
  localStorage.removeItem("pokerole_token");
}
