import { createFileRoute } from "@tanstack/react-router";
import { SectorsContent } from "@/components/sectors-content";

export const Route = createFileRoute("/sectores")({
  head: () => ({
    meta: [
      { title: "Elegí tu sector — LRG Store Shop" },
      {
        name: "description",
        content:
          "Arcade para gaming, Scents para perfumería árabe y Web Design para software. Cada sector con su propia identidad y catálogo.",
      },
      { property: "og:title", content: "Elegí tu sector — LRG Store Shop" },
      {
        property: "og:description",
        content: "Tres sectores independientes dentro del ecosistema LRG Store Shop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SectorsContent,
});
