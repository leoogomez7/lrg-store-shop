export type AuthRole = "admin" | "client";

const AUTH_ROLE_KEY = "lrg_auth_role";

export function getAuthRole(): AuthRole | null {
  if (typeof window === "undefined") return null;

  const storedRole = window.localStorage.getItem(AUTH_ROLE_KEY);
  if (storedRole === "admin" || storedRole === "client") return storedRole;

  const sessionRole = window.sessionStorage.getItem(AUTH_ROLE_KEY);
  if (sessionRole !== "admin" && sessionRole !== "client") return null;

  window.localStorage.setItem(AUTH_ROLE_KEY, sessionRole);
  return sessionRole;
}

export function setAuthRole(role: AuthRole): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_ROLE_KEY, role);
}

export function clearAuthRole(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_ROLE_KEY);
  window.sessionStorage.removeItem(AUTH_ROLE_KEY);
}
