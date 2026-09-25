import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DynamicServerError } from "next/dist/client/components/hooks-server-context";
import { redirect } from "next/navigation";
import { DEFAULT_PROFILE } from "@/lib/schemas/site";

// site-config.read() se replie sur les valeurs par défaut si Redis est
// indisponible, MAIS doit laisser passer les signaux internes de Next
// (unstable_rethrow) : sinon, au prérendu, l'erreur « rendu dynamique requis »
// est avalée et la page est figée avec le profil par défaut.

const r = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/server/redis", () => ({ getRedis: () => ({ get: r.get }) }));

beforeEach(() => {
  r.get.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("site-config — lecture Redis", () => {
  it("signal de rendu dynamique (DYNAMIC_SERVER_USAGE) → propagé, pas de valeurs par défaut", async () => {
    const signal = new DynamicServerError("Route / couldn't be rendered statically");
    r.get.mockRejectedValue(signal);
    const { getProfile } = await import("@/lib/server/site-config");
    await expect(getProfile()).rejects.toBe(signal);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("redirect() levé pendant la lecture → propagé (NEXT_REDIRECT)", async () => {
    r.get.mockImplementation(async () => redirect("/login"));
    const { getProfile } = await import("@/lib/server/site-config");
    await expect(getProfile()).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT/) });
  });

  it("vraie panne Redis → valeurs par défaut, erreur journalisée", async () => {
    r.get.mockRejectedValue(new Error("ECONNRESET"));
    const { getProfile } = await import("@/lib/server/site-config");
    await expect(getProfile()).resolves.toEqual(DEFAULT_PROFILE);
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
