import { describe, expect, it } from "vitest";
import { parsePerfumeNotesResponse } from "./perfume-ai-import.server";

describe("AI perfume notes response parsing", () => {
  it("formats notes and returns only cited non-Fragrantica sources", () => {
    const result = parsePerfumeNotesResponse({
      candidates: [
        {
          content: {
            parts: [
              {
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
              },
            ],
          },
          groundingMetadata: {
            groundingChunks: [
              { web: { title: "Sitio oficial", uri: "https://example.com/perfume" } },
              { web: { title: "Fragrantica", uri: "https://www.fragrantica.es/perfume/example" } },
            ],
          },
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
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    matched: true,
                    title: "Perfume",
                    reason: "",
                    notes: { top: ["rosa"], heart: [], base: [] },
                  }),
                },
              ],
            },
          },
        ],
      }),
    ).toThrow("fuentes verificables");
  });

  it("preserves a no-match response for the UI to explain", () => {
    const result = parsePerfumeNotesResponse({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  matched: false,
                  title: "",
                  reason: "No se pudo confirmar el perfume.",
                  notes: { top: [], heart: [], base: [] },
                }),
              },
            ],
          },
          groundingMetadata: {
            groundingChunks: [{ web: { title: "Marca", uri: "https://brand.example" } }],
          },
        },
      ],
    });

    expect(result.matched).toBe(false);
    expect(result.description).toBe("");
    expect(result.reason).toBe("No se pudo confirmar el perfume.");
  });

  it("accepts Ollama local responses without requiring web citations", () => {
    const result = parsePerfumeNotesResponse({
      response: JSON.stringify({
        matched: true,
        title: "Lattafa His Confession",
        reason: "Coincide el nombre y la marca.",
        notes: {
          top: ["canela", "lavanda"],
          heart: ["iris"],
          base: ["vainilla", "ámbar"],
        },
      }),
    });

    expect(result).toEqual({
      matched: true,
      title: "Lattafa His Confession",
      reason: "Coincide el nombre y la marca.",
      description:
        "Notas de salida: canela, lavanda\nNotas de corazón: iris\nNotas de fondo: vainilla, ámbar",
      sources: [],
    });
  });
});