import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cuenta/pedidos")({
  beforeLoad: () => {
    throw redirect({ to: "/cuenta/compras" });
  },
  component: () => null,
});
