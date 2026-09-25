import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import path from "node:path";
import * as shared from "@/lib/schemas/services";
import * as server from "@/lib/server/validation";

// Écran admin des services : il valide côté client avec les MÊMES schémas que
// les routes /api/admin/services (un seul module, réexporté côté serveur).

describe("schémas des services, partagés client/serveur", () => {
  it("les routes utilisent exactement les schémas de l'écran admin", () => {
    expect(server.serviceCreateSchema).toBe(shared.serviceCreateSchema);
    expect(server.serviceUpdateSchema).toBe(shared.serviceUpdateSchema);
    expect(server.availabilityReplaceSchema).toBe(shared.availabilityReplaceSchema);
  });

  it("service : nom requis, durée entre 15 et 480 min, champ inconnu refusé", () => {
    expect(shared.serviceCreateSchema.safeParse({ name: "Appel découverte", durationMin: 30 }).success).toBe(true);
    expect(shared.serviceCreateSchema.safeParse({ name: " ", durationMin: 30 }).success).toBe(false);
    expect(shared.serviceCreateSchema.safeParse({ name: "X", durationMin: 10 }).success).toBe(false);
    expect(shared.serviceCreateSchema.safeParse({ name: "X", durationMin: 481 }).success).toBe(false);
    expect(shared.serviceCreateSchema.safeParse({ name: "X", durationMin: 30, id: "force" }).success).toBe(false);
  });

  it("planning : jour 0-6, HH:MM, plage non vide", () => {
    const ok = { slots: [{ weekday: 1, startTime: "09:00", endTime: "12:00" }] };
    expect(shared.availabilityReplaceSchema.safeParse(ok).success).toBe(true);
    expect(shared.availabilityReplaceSchema.safeParse({ slots: [] }).success).toBe(true);
    expect(shared.availabilityReplaceSchema.safeParse({ slots: [{ weekday: 7, startTime: "09:00", endTime: "12:00" }] }).success).toBe(false);
    expect(shared.availabilityReplaceSchema.safeParse({ slots: [{ weekday: 1, startTime: "12:00", endTime: "09:00" }] }).success).toBe(false);
    expect(shared.availabilityReplaceSchema.safeParse({ slots: [{ weekday: 1, startTime: "9h", endTime: "12:00" }] }).success).toBe(false);
  });

  it("l'écran /admin/services existe (couvert par la garde du layout admin)", () => {
    const dir = path.join(process.cwd(), "app", "(admin)", "admin", "services");
    expect(readdirSync(dir)).toContain("page.tsx");
  });
});
