import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown, safeUrl } from "@/components/content/Markdown";

// Contenu saisi dans l'admin, rendu sur les pages publiques (dont la CSP
// garde 'unsafe-inline') : aucune injection ne doit produire de HTML actif.

const render = (md: string) => renderToStaticMarkup(<Markdown>{md}</Markdown>);

describe("Markdown — éléments autorisés", () => {
  it("rend titres, paragraphes, listes, gras, italique, code, citations", () => {
    const html = render("## Titre\n\nTexte **gras** et *italique* avec `code`.\n\n- un\n- deux\n\n> citation");
    expect(html).toContain("<h2");
    expect(html).toContain("<strong>gras</strong>");
    expect(html).toContain("<em>italique</em>");
    expect(html).toContain("<code");
    expect(html).toContain("<ul");
    expect(html).toContain("<blockquote");
  });

  it("lien http(s) : conservé, avec rel=\"noopener noreferrer\"", () => {
    const html = render("[site](https://example.com/page)");
    expect(html).toMatch(/<a href="https:\/\/example\.com\/page" rel="noopener noreferrer"/);
  });
});

describe("Markdown — injections neutralisées", () => {
  it.each([
    ["balise script", "Bonjour <script>alert(1)</script> fin"],
    ["script en bloc", "<script>\nalert(1)\n</script>"],
    ["img onerror", 'Texte <img src="x" onerror="alert(1)"> fin'],
    ["svg onload", '<svg onload="alert(1)"></svg>'],
    ["iframe", '<iframe src="https://evil.example"></iframe>'],
    ["style", "<style>body{display:none}</style>"],
    ["attribut dans un lien HTML", '<a href="#" onclick="alert(1)">clic</a>'],
  ])("%s : aucune balise ni attribut actif", (_label, md) => {
    const html = render(md);
    expect(html).not.toMatch(/<script|<img|<svg|<iframe|<style|onerror|onload|onclick/i);
  });

  it.each([
    ["javascript:", "[clic](javascript:alert(1))"],
    ["JavaScript en casse mixte", "[clic](JaVaScRiPt:alert(1))"],
    ["data:", "[clic](data:text/html,<script>alert(1)</script>)"],
    ["vbscript:", "[clic](vbscript:msgbox(1))"],
    ["relatif au protocole", "[clic](//evil.example)"],
  ])("lien %s : href retiré", (_label, md) => {
    const html = render(md);
    expect(html).not.toMatch(/href=/i);
    expect(html).toContain("clic"); // le texte du lien reste lisible
  });

  it("images Markdown interdites (même en https)", () => {
    const html = render("![logo](https://evil.example/track.png)");
    expect(html).not.toMatch(/<img/i);
  });

  it("titre de niveau 1 (hors liste blanche) : texte conservé, balise retirée", () => {
    const html = render("# Grand titre");
    expect(html).not.toContain("<h1");
    expect(html).toContain("Grand titre");
  });

  it("safeUrl : seules les URL http(s) absolues passent", () => {
    expect(safeUrl("https://a.example/x")).toBe("https://a.example/x");
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("/relatif")).toBe("");
    expect(safeUrl("mailto:a@b.c")).toBe("");
  });
});
