import { createFileRoute } from "@tanstack/react-router";
import { createAdminBackup } from "@/server/persistence";

const getCronSecret = () =>
  import.meta.env["CRON_SECRET"]?.trim() ??
  (typeof process !== "undefined" ? process.env.CRON_SECRET?.trim() : undefined);

export const Route = createFileRoute("/api/cron/backup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const configuredSecret = getCronSecret();
        const authorization = request.headers.get("authorization");
        const expectedAuthorization = configuredSecret ? `Bearer ${configuredSecret}` : null;

        if (!configuredSecret || authorization !== expectedAuthorization) {
          return new Response("Unauthorized", { status: 401 });
        }

        const created = await createAdminBackup({ data: { reason: "weekly-scheduled" } });
        return created
          ? Response.json({ ok: true })
          : Response.json({ ok: false, error: "Database is not configured" }, { status: 503 });
      },
    },
  },
});