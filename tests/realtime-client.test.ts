import { describe, expect, it } from "vitest";
import { FULL_REFRESH_MS, needsFullRefresh } from "@/lib/hooks/use-poll";
import { mergeMessages, type ThreadMessage } from "@/lib/messaging/client";
import { notificationText } from "@/lib/notifications/client";

const msg = (id: string, at: string, content = id): ThreadMessage => ({ id, sender: "VISITOR", content, createdAt: at });

describe("filet de sécurité du polling", () => {
  it("rafraîchissement complet au premier tick puis toutes les 2 min 30", () => {
    expect(FULL_REFRESH_MS).toBeGreaterThanOrEqual(120_000);
    expect(FULL_REFRESH_MS).toBeLessThanOrEqual(180_000);
    expect(needsFullRefresh(null, 1000)).toBe(true);
    expect(needsFullRefresh(0, FULL_REFRESH_MS - 1)).toBe(false);
    expect(needsFullRefresh(0, FULL_REFRESH_MS)).toBe(true);
  });
});

describe("mergeMessages", () => {
  it("fusionne sans doublon, dans l'ordre chronologique", () => {
    const current = [msg("a", "2026-09-24T10:00:00Z"), msg("b", "2026-09-24T10:01:00Z")];
    const incoming = [msg("b", "2026-09-24T10:01:00Z", "b (maj)"), msg("c", "2026-09-24T10:02:00Z")];
    expect(mergeMessages(current, incoming).map((m) => `${m.id}:${m.content}`)).toEqual(["a:a", "b:b (maj)", "c:c"]);
  });
});

describe("texte des notifications (construit depuis la base, rendu en texte)", () => {
  it("message, lead, changement de statut, réservation", () => {
    expect(notificationText({ type: "message", payload: { name: "Camille" } })).toBe("Nouveau message de Camille.");
    expect(notificationText({ type: "lead", payload: { name: "Camille", subject: "Refonte" } })).toBe("Nouveau lead : Camille — Refonte.");
    expect(notificationText({ type: "lead", payload: { name: "Camille", from: "NEW", to: "CONTACTED" } })).toBe("Lead Camille : Nouveau → Contacté.");
    expect(notificationText({ type: "booking", payload: { name: "Léa", service: "Audit express", startAt: "2026-07-10T08:00:00Z" } })).toBe(
      "Nouvelle réservation : Léa — Audit express, ven. 10 juil., 10:00."
    );
  });

  it("payload hostile : restitué tel quel comme texte, jamais interprété", () => {
    expect(notificationText({ type: "message", payload: { name: "<img src=x onerror=alert(1)>" } })).toBe("Nouveau message de <img src=x onerror=alert(1)>.");
  });

  it("payload absent ou inconnu : texte générique", () => {
    expect(notificationText({ type: "message", payload: null })).toBe("Nouveau message de Visiteur.");
    expect(notificationText({ type: "autre", payload: {} })).toBe("Nouvelle activité.");
  });
});
