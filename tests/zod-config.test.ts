import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

// Zod en mode `jitless` pour les schémas partagés : sinon Zod teste
// `new Function("")` à la création de chaque z.object(), la CSP de
// production le bloque et le navigateur signale une violation kEvalViolation.

const SCHEMAS_DIR = path.join(process.cwd(), "lib", "schemas");

describe("Zod — configuration jitless des schémas partagés", () => {
  it("charger un schéma active jitless", async () => {
    await import("@/lib/schemas/message");
    expect(z.config().jitless).toBe(true);
  });

  it("aucun fichier de lib/schemas n'importe \"zod\" directement (hors lib/schemas/zod.ts)", () => {
    const offenders = readdirSync(SCHEMAS_DIR)
      .filter((f) => f.endsWith(".ts") && f !== "zod.ts")
      .filter((f) => /from\s+["']zod["']/.test(readFileSync(path.join(SCHEMAS_DIR, f), "utf8").replace(/import type[^;]+;/g, "")));
    expect(offenders).toEqual([]);
  });

  it("la validation reste identique en jitless (e-mail invalide, champ requis)", async () => {
    const { startConversationSchema } = await import("@/lib/schemas/message");
    const bad = startConversationSchema.safeParse({ visitorName: "", visitorEmail: "pas-un-email", content: "" });
    expect(bad.success).toBe(false);
    const paths = bad.success ? [] : bad.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["visitorEmail", "content"]));
    expect(startConversationSchema.safeParse({ visitorName: "", visitorEmail: "camille@example.fr", content: "Bonjour" }).success).toBe(true);
  });
});
