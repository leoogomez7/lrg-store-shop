import { describe, expect, it } from "vitest";
import { parsePerfumeNotesResponse } from "./perfume-ai-import.server";

describe("AI perfume notes response parsing", () => {
  it("formats notes and returns only cited non-Fragrantica sources", () => {
    const result = parsePerfumeNotesResponse({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                matched: true,
                title: "Lattafa His Confession",
                reason: "Coincide el nombre y la marca.",
                notes: {
                  top: ["canela", "lavanda"],
                  heart: ["iris"],
                  base: ["vainilla", "ámbar"],
                },
              }),
              annotations: [
                {
                  type: "url_citation",
                  title: "Sitio oficial",
                  url: "https://example.com/perfume",
                },
                {
                  type: "url_citation",
                  title: "Fragrantica",
                  url: "https://www.fragrantica.es/perfume/example",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result).toEqual({
      matched: true,
      title: "Lattafa His Confession",
      reason: "Coincide el nombre y la marca.",
      description:
        "Notas de salida: canela, lavanda\nNotas de corazón: iris\nNotas de fondo: vainilla, ámbar",
      sources: [{ title: "Sitio oficial", url: "https://example.com/perfume" }],
    });
  });

  it("rejects results without verifiable citations", () => {
    expect(() =>
      parsePerfumeNotesResponse({
        output_text: JSON.stringify({
          matched: true,
          title: "Perfume",
          reason: "",
          notes: { top: ["rosa"], heart: [], base: [] },
        }),
      }),
    ).toThrow("fuentes verificables");
  });

  it("preserves a no-match response for the UI to explain", () => {
    const result = parsePerfumeNotesResponse({
      output_text: JSON.stringify({
        matched: false,
        title: "",
        reason: "No se pudo confirmar el perfume.",
        notes: { top: [], heart: [], base: [] },
      }),
      output: [{ type: "web_search_call", action: { sources: [{ title: "Marca", url: "https://brand.example" }] } }],
    });

    expect(result.matched).toBe(false);
    expect(result.description).toBe("");
    expect(result.reason).toBe("No se pudo confirmar el perfume.");
  });
});