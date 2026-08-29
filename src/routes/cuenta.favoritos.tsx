import { createFileRoute } from "@tanstack/react-router";
import { AccountPageSection } from "./cuenta";

export const Route = createFileRoute("/cuenta/favoritos")({
  component: () => <AccountPageSection initialTab="favorites" />,
});
