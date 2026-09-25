import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { profileSchema } from "@/lib/schemas/site";
import { articleCreateSchema, experienceCreateSchema, projectCreateSchema, skillCreateSchema } from "@/lib/schemas/content";

// Le seed est la source d'une installation neuve : il ne doit contenir que
// les vraies informations du profil, sans contenu d'exemple, et aucune trace
// des données fictives d'origine ne doit subsister dans le code livré.

const ROOT = process.cwd();
const seed = JSON.parse(readFileSync(path.join(ROOT, "prisma", "seed-data.json"), "utf8"));
const FICTIONAL = /Nina|Sonier|ninaso|moisson|Logora|Kargo/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe("prisma/seed-data.json", () => {
  it("profil valide, avec les informations réelles", () => {
    const profile = profileSchema.parse(seed.profile);
    expect(profile).toMatchObject({ name: "Aguidissou Carlos", role: "Développeur web full-stack", location: "Cotonou, Cadjèhoun" });
  });

  it("aucun contenu d'exemple : projets, articles, parcours, compétences et services vides", () => {
    for (const key of ["projects", "articles", "experiences", "skills", "services"]) {
      expect(seed[key], key).toEqual([]);
    }
  });

  it("chaque entrée future reste validée par les schémas de l'API (tableaux vides acceptés)", () => {
    const checks: [unknown[], { parse: (v: unknown) => unknown }][] = [
      // `cover` est lu par le seed (fichier de couverture), pas par l'API.
      [seed.projects.map((p: Record<string, unknown>) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== "cover"))), projectCreateSchema],
      [seed.articles, articleCreateSchema],
      [seed.experiences, experienceCreateSchema],
      [seed.skills, skillCreateSchema],
    ];
    for (const [items, schema] of checks) for (const item of items) expect(() => schema.parse(item)).not.toThrow();
  });
});

describe("aucune donnée fictive dans le code livré", () => {
  it("ni dans le seed, ni dans app/, components/, lib/, public/", () => {
    // public/ peut ne pas exister (aucun fichier statique pour l'instant).
    const dirs = ["app", "components", "lib", "public"].map((d) => path.join(ROOT, d)).filter((d) => existsSync(d));
    const files = [path.join(ROOT, "prisma", "seed-data.json"), ...dirs.flatMap((d) => walk(d))];
    const offenders = files
      .filter((f) => /\.(tsx?|json|svg|mjs)$/.test(f))
      .filter((f) => FICTIONAL.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("le portrait fictif n'est plus livré", () => {
    expect(existsSync(path.join(ROOT, "public", "portrait.svg"))).toBe(false);
  });
});
