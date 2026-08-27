import { createServerFn } from "@tanstack/react-start";

function configuredSecret(value: string | undefined): string {
  return value?.trim() ?? "";
}

function environmentSecret(name: string, fallbackName?: string): string {
  const runtimeValue = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  const buildValue =
    import.meta.env[name] ?? (fallbackName ? import.meta.env[fallbackName] : undefined);
  return configuredSecret(runtimeValue ?? buildValue);
}

export const verifyAdminPassword = createServerFn({ method: "POST" })
  .validator((data: { password: string }) => data)
  .handler(({ data }) => {
    const expected = environmentSecret("ADMIN", "ADMIN_PASSWORD");
    return Boolean(expected) && data.password === expected;
  });

export const verifyAdminFinalPassword = createServerFn({ method: "POST" })
  .validator((data: { password: string }) => data)
  .handler(({ data }) => {
    const expected = environmentSecret("ADMIN_FINAL", "ADMIN_FINAL_PASSWORD");
    return Boolean(expected) && data.password === expected;
  });
