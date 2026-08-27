export async function logout(): Promise<void> {
  try {
    // Attempt server-side logout (best-effort)
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    // ignore network errors — continue clearing client state
  }
}
