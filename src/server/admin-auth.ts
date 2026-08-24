import { createServerFn } from "@tanstack/react-start";

function configuredSecret(value: string | undefined): string {
  return value?.trim() ?? "";
}

export const verifyAdminPassword = createServerFn({ method: "POST" })
  .handler(({ data }: { data: { password: string } }) => {
    const expected = configuredSecret(import.meta.env.ADMIN);
    return Boolean(expected) && data.password === expected;
  });

export const verifyAdminFinalPassword = createServerFn({ method: "POST" })
  .handler(({ data }: { data: { password: string } }) => {
    const expected = configuredSecret(import.meta.env.ADMIN_FINAL);
    return Boolean(expected) && data.password === expected;
  });