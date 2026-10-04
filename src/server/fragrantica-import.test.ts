import { describe, expect, it } from "vitest";
import {
  extractPerfumeDescription,
  rankPerfumeLinkMatches,
} from "./fragrantica-import";

describe("Fragrantica description import parsing", () => {
  it("matches perfume links by product name without requiring an exact link title", () => {
    const html = `
      <a href="/perfume/Afnan/9-PM-65414.html">perfume 9 PM Afnan para Hombres</a>
      <a href="/perfume/Afnan/Supremacy-Collector-98689.html">Supremacy Collector's Edition</a>
    `;

    expect(rankPerfumeLinkMatches(html, "Afnan 9PM 100ml")).toEqual([
      expect.objectContaining({
        title: "perfume 9 PM Afnan para Hombres",
        url: "/perfume/Afnan/9-PM-65414.html",
        score: 1,
      }),
    ]);
  });

  it("extracts only the note pyramid from perfume detail headings", () => {
    const html = `
      <h1>9pm Afnan para Hombres</h1>
      <h4>NOTAS DE SALIDA</h4>
      <a>manzana</a><a>canela</a>
      <h4>CORAZÓN</h4>
      <a>flor de azahar</a>
      <h4>BASE</h4>
      <a>vainilla</a><a>ámbar</a>
      <h4>Diseñador Afnan</h4>
      <p>Reseña de usuario que no debe importarse.</p>
    `;

    expect(extractPerfumeDescription(html)).toEqual({
      title: "9pm Afnan para Hombres",
      description:
        "Notas de salida: manzana, canela\nNotas de corazón: flor de azahar\nNotas de fondo: vainilla, ámbar",
    });
  });

  it("returns null if the detail page has no note sections", () => {
    expect(extractPerfumeDescription("<h1>Perfume</h1><p>Sin pirámide olfativa</p>")).toBeNull();
  });
});
