import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { validateContact } from "@/lib/contact/client";

// POST /api/contact : Contact + Lead NEW + LeadEvent ∅→NEW dans UNE
// transaction. La base est simulée en mémoire avec une vraie sémantique
// transactionnelle : les écritures faites via `tx` ne sont appliquées que si
// la transaction aboutit ; celles faites hors transaction le sont tout de suite.

type Row = Record<string, unknown> & { id: string };
type Tables = { contacts: Row[]; leads: Row[]; events: Row[]; notifications: Row[] };

const mem = vi.hoisted(() => {
  const state = {
    tables: { contacts: [], leads: [], events: [], notifications: [] } as Tables,
    failOn: null as null | "lead" | "event",
    seq: 0,
  };
  const client = (t: Tables) => {
    const insert = (table: keyof Tables, prefix: string, fail?: "lead" | "event") =>
      async ({ data }: { data: Record<string, unknown> }) => {
        if (fail && state.failOn === fail) throw new Error(`échec simulé : ${fail}`);
        const row = { id: `${prefix}${++state.seq}`, ...data };
        t[table].push(row);
        return row;
      };
    return {
      contact: { create: insert("contacts", "c") },
      lead: { create: insert("leads", "l", "lead") },
      leadEvent: { create: insert("events", "e", "event") },
      notification: { create: insert("notifications", "n") },
    };
  };
  const db = {
    ...client(state.tables),
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const staged: Tables = structuredClone(state.tables);
      const result = await fn(client(staged));
      Object.assign(state.tables, staged); // commit seulement si fn a réussi
      return result;
    },
  };
  return { state, db };
});

vi.mock("@/lib/server/db", () => ({ db: mem.db }));
// Le temps réel (incréments Redis best-effort) n'est pas l'objet de ce test.
vi.mock("@/lib/server/realtime", () => ({
  bumpAdminVersion: async () => {},
  bumpConversationVersion: async () => {},
  getAdminVersion: async () => 0,
  getConversationVersion: async () => 0,
}));
vi.mock("@/lib/server/rate-limit", () => ({
  checkLimits: async () => ({ success: true, reset: 0 }),
  tooManyRequests: () => new Response(null, { status: 429 }),
}));

const valid = { name: "Camille Dupont", email: "Camille@Example.fr", subject: "Refonte", message: "Bonjour, un projet de refonte à discuter." };

async function post(body: unknown) {
  const { POST } = await import("@/app/api/contact/route");
  return POST(
    new NextRequest("http://localhost/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  mem.state.tables.contacts.length = 0;
  mem.state.tables.leads.length = 0;
  mem.state.tables.events.length = 0;
  mem.state.tables.notifications.length = 0;
  mem.state.failOn = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/contact → lead créé", () => {
  it("crée le Contact, un Lead NEW rattaché, le LeadEvent ∅→NEW et une notification", async () => {
    const res = await post(valid);
    expect(res.status).toBe(201);

    const { contacts, leads, events, notifications } = mem.state.tables;
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ name: "Camille Dupont", email: "camille@example.fr" });
    expect(String(contacts[0].message)).toContain("[Refonte]");

    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ contactId: contacts[0].id, status: "NEW", source: "Formulaire de contact" });

    expect(events).toEqual([expect.objectContaining({ leadId: leads[0].id, fromStatus: null, toStatus: "NEW" })]);
    expect(notifications).toEqual([expect.objectContaining({ type: "lead" })]);
  });

  it("atomicité : si la création du lead échoue, AUCUN contact n'est enregistré", async () => {
    mem.state.failOn = "lead";
    const res = await post(valid);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur interne. Réessayez." });
    expect(mem.state.tables).toEqual({ contacts: [], leads: [], events: [], notifications: [] });
  });

  it("atomicité : si l'événement échoue, ni contact ni lead", async () => {
    mem.state.failOn = "event";
    expect((await post(valid)).status).toBe(500);
    expect(mem.state.tables.contacts).toHaveLength(0);
    expect(mem.state.tables.leads).toHaveLength(0);
  });

  it("pot de miel rempli : succès apparent, rien d'écrit", async () => {
    expect((await post({ ...valid, website: "http://spam.example" })).status).toBe(201);
    expect(mem.state.tables.contacts).toHaveLength(0);
    expect(mem.state.tables.leads).toHaveLength(0);
  });

  it("entrée invalide : 400, rien d'écrit", async () => {
    expect((await post({ ...valid, message: "court" })).status).toBe(400);
    expect(mem.state.tables.contacts).toHaveLength(0);
  });
});

describe("validation client = validation serveur (schéma partagé)", () => {
  it("le formulaire refuse ce que l'API refuse, avec le même message", async () => {
    const values = { ...valid, message: "court", website: "" };
    const client = validateContact(values);
    expect(client.errors?.message).toBeDefined();

    const res = await post({ ...valid, message: "court" });
    const body = await res.json();
    expect(body.issues).toEqual([{ path: "message", message: client.errors?.message }]);
  });

  it("le formulaire accepte ce que l'API accepte", async () => {
    expect(validateContact({ ...valid, website: "" }).errors).toBeUndefined();
    expect((await post(valid)).status).toBe(201);
  });
});
