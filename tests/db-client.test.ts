import { describe, expect, it, vi } from "vitest";

// Régression réelle (vue en test navigateur) : après une mise en veille de
// Neon, la première transaction échouait en P2028 avec le délai par défaut de
// Prisma (2 s). Le client doit être construit avec un délai suffisant.

const ctor = vi.hoisted(() => ({ args: [] as unknown[] }));
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    constructor(options: unknown) {
      ctor.args.push(options);
    }
  },
}));

describe("client Prisma", () => {
  it("laisse ≥ 10 s pour démarrer une transaction (réveil de Neon)", async () => {
    const { TRANSACTION_OPTIONS } = await import("@/lib/server/db");
    expect(ctor.args).toEqual([{ transactionOptions: TRANSACTION_OPTIONS }]);
    expect(TRANSACTION_OPTIONS.maxWait).toBeGreaterThanOrEqual(10_000);
    expect(TRANSACTION_OPTIONS.timeout).toBeGreaterThan(TRANSACTION_OPTIONS.maxWait);
  });
});
