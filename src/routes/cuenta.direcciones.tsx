import { createFileRoute } from "@tanstack/react-router";
import { AccountPageSection } from "./cuenta";

export const Route = createFileRoute("/cuenta/direcciones")({
  component: () => <AccountPageSection initialTab="addresses" />,
});
