import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { DEFAULT_REDIRECT, safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath — cibles refusées (→ /admin)", () => {
  it.each([
    // Cas demandés
    ["//evil.com", "URL relative au protocole"],
    ["/\\evil.com", "antislash lu comme / par les navigateurs"],
    ["https://evil.com", "URL absolue"],
    ["javascript:alert(1)", "schéma javascript:"],
    ["%2f%2fevil.com", "// encodé"],
    // Variantes
    ["%2F%2Fevil.com", "// encodé en majuscules"],
    ["/%2fevil.com", "second / encodé"],
    ["/%5cevil.com", "antislash encodé"],
    ["%5c%5cevil.com", "\\\\ encodé"],
    ["%252f%252fevil.com", "double encodage"],
    ["\\\\evil.com", "\\\\ brut"],
    ["/\t/evil.com", "tabulation (supprimée par le navigateur)"],
    ["/%09/evil.com", "tabulation encodée"],
    ["/\n/evil.com", "saut de ligne"],
    ["\u0000/admin", "caractère nul"],
    [" /admin", "espace en tête"],
    ["\t/admin", "tabulation en tête"],
    ["%20//evil.com", "espace encodé en tête"],
    ["HTTPS://evil.com", "schéma en majuscules"],
    ["data:text/html,<script>alert(1)</script>", "schéma data:"],
    ["evil.com", "sans / initial"],
    ["admin", "chemin relatif"],
    ["/%E0%A4%A", "encodage malformé"],
    ["/" + "a".repeat(3000), "longueur excessive"],
  ])("%j (%s)", (input) => {
    expect(safeRedirectPath(input)).toBe(DEFAULT_REDIRECT);
  });

  it("valeur absente ou vide", () => {
    expect(safeRedirectPath(null)).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectPath(undefined)).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectPath("")).toBe(DEFAULT_REDIRECT);
  });

  it("repli personnalisable", () => {
    expect(safeRedirectPath("//evil.com", "/")).toBe("/");
  });
});

describe("safeRedirectPath — chemins internes acceptés", () => {
  it.each([
    ["/admin/projets", "/admin/projets"],
    ["/admin", "/admin"],
    ["/", "/"],
    ["/admin/leads?status=NEW#top", "/admin/leads?status=NEW#top"],
    ["/admin/projets/%C3%A9t%C3%A9", "/admin/projets/%C3%A9t%C3%A9"],
    ["/admin/a:b", "/admin/a:b"], // « : » dans un chemin n'est pas un schéma
  ])("%j → %j", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it("le résultat ne sort jamais du site, quelle que soit l'entrée", () => {
    const inputs = ["//evil.com", "/\\evil.com", "https://evil.com", "/admin/projets", "%2f%2fevil.com"];
    for (const input of inputs) {
      const out = safeRedirectPath(input);
      expect(new URL(out, "https://site.example").origin).toBe("https://site.example");
    }
  });
});

describe("toute lecture de ?next= passe par safeRedirectPath()", () => {
  const root = path.resolve(__dirname, "..");
  const sources: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name)) sources.push(full);
    }
  };
  for (const dir of ["app", "components", "lib"]) walk(path.join(root, dir));
  sources.push(path.join(root, "proxy.ts"));

  // Lectures du paramètre : .get("next"), searchParams.next, searchParams["next"].
  const READ = /\.get\(\s*["']next["']\s*\)|searchParams\??\.next\b|searchParams\??\[\s*["']next["']\s*\]/g;

  it("chaque lecture est enveloppée par safeRedirectPath(…)", () => {
    const offenders: string[] = [];
    let reads = 0;
    for (const file of sources) {
      readFileSync(file, "utf8").split("\n").forEach((line, i) => {
        const count = line.match(READ)?.length ?? 0;
        reads += count;
        if (count && !/safeRedirectPath\(/.test(line)) offenders.push(`${path.relative(root, file)}:${i + 1}`);
      });
    }
    expect(reads).toBeGreaterThan(0); // le formulaire de login lit bien ?next=
    expect(offenders).toEqual([]);
  });
});
