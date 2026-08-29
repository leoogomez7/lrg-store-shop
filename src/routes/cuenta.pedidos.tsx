import { createFileRoute } from "@tanstack/react-router";
import { AccountPageSection } from "./cuenta";

export const Route = createFileRoute("/cuenta/pedidos")({
  component: () => <AccountPageSection initialTab="orders" />,
});
