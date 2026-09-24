import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNIDENTIFIED_CLIENT, getClientIp, normalizeIp, resetClientIpWarning } from "@/lib/server/client-ip";

const h = (init: Record<string, string>) => new Headers(init);
const TRUSTED = { TRUST_PROXY: "true" };

describe("getClientIp — confiance aux headers proxy", () => {
  it("sans TRUST_PROXY, ignore des headers falsifiés (x-real-ip comme x-forwarded-for)", () => {
    const forged = h({ "x-real-ip": "203.0.113.66", "x-forwarded-for": "198.51.100.1, 198.51.100.2" });
    expect(getClientIp(forged, {})).toBe(UNIDENTIFIED_CLIENT);
    // Un attaquant qui change de header à chaque requête reste dans le même compartiment.
    expect(getClientIp(h({ "x-real-ip": "203.0.113.67" }), {})).toBe(UNIDENTIFIED_CLIENT);
  });

  it("TRUST_PROXY=false l'emporte même sur Vercel", () => {
    expect(getClientIp(h({ "x-real-ip": "203.0.113.5" }), { VERCEL: "1", TRUST_PROXY: "false" })).toBe(UNIDENTIFIED_CLIENT);
  });

  it("confiance automatique quand VERCEL=1", () => {
    expect(getClientIp(h({ "x-real-ip": "203.0.113.5" }), { VERCEL: "1" })).toBe("203.0.113.5");
  });

  it("x-real-ip valide d'abord", () => {
    const headers = h({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "198.51.100.9" });
    expect(getClientIp(headers, TRUSTED)).toBe("203.0.113.5");
  });

  it("x-real-ip invalide → x-forwarded-for", () => {
    const headers = h({ "x-real-ip": "pas-une-ip", "x-forwarded-for": "198.51.100.9" });
    expect(getClientIp(headers, TRUSTED)).toBe("198.51.100.9");
  });
});

describe("getClientIp — x-forwarded-for compté depuis la droite", () => {
  // Le client peut préfixer ce qu'il veut ; le proxy de confiance ajoute
  // l'IP réelle à DROITE.
  const chain = h({ "x-forwarded-for": "1.1.1.1, 10.0.0.1, 198.51.100.7" });

  it("TRUST_PROXY_HOPS=1 (défaut) : dernier élément, jamais le premier falsifiable", () => {
    expect(getClientIp(chain, TRUSTED)).toBe("198.51.100.7");
    expect(getClientIp(chain, TRUSTED)).not.toBe("1.1.1.1");
  });

  it("TRUST_PROXY_HOPS=2 : avant-dernier élément", () => {
    expect(getClientIp(chain, { ...TRUSTED, TRUST_PROXY_HOPS: "2" })).toBe("10.0.0.1");
  });

  it("plus de sauts que d'éléments → repli", () => {
    expect(getClientIp(chain, { ...TRUSTED, TRUST_PROXY_HOPS: "5" })).toBe(UNIDENTIFIED_CLIENT);
  });

  it("valeur non IP à la position retenue → repli (pas de valeur brute)", () => {
    expect(getClientIp(h({ "x-forwarded-for": "198.51.100.7, <script>" }), TRUSTED)).toBe(UNIDENTIFIED_CLIENT);
  });
});

describe("normalisation IPv6 au préfixe /64", () => {
  it("ramène une IPv6 à son /64", () => {
    expect(normalizeIp("2001:db8:abcd:12:1:2:3:4")).toBe("2001:db8:abcd:12::/64");
  });

  it("deux adresses du même /64 partagent la même clé, un autre /64 non", () => {
    const a = getClientIp(h({ "x-real-ip": "2001:db8:abcd:12::1" }), TRUSTED);
    const b = getClientIp(h({ "x-real-ip": "2001:DB8:ABCD:12:ffff:ffff:ffff:ffff" }), TRUSTED);
    const other = getClientIp(h({ "x-real-ip": "2001:db8:abcd:13::1" }), TRUSTED);
    expect(a).toBe("2001:db8:abcd:12::/64");
    expect(b).toBe(a);
    expect(other).not.toBe(a);
  });

  it("gère les formes compressées, crochets + port, zone et IPv4 mappée", () => {
    expect(normalizeIp("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(normalizeIp("::1")).toBe("0:0:0:0::/64");
    expect(normalizeIp("[2001:db8:1:2::5]:443")).toBe("2001:db8:1:2::/64");
    expect(normalizeIp("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
    expect(normalizeIp("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(normalizeIp("203.0.113.9:8080")).toBe("203.0.113.9");
  });
});

describe("IP absente ou invalide → repli sûr", () => {
  it.each([
    ["aucun header", {}],
    ["x-real-ip vide", { "x-real-ip": "" }],
    ["texte", { "x-real-ip": "unknown" }],
    ["octet hors plage", { "x-real-ip": "999.1.1.1" }],
    ["injection", { "x-forwarded-for": "1.2.3.4; DROP TABLE" }],
    ["valeur démesurée", { "x-real-ip": "1".repeat(500) }],
  ])("%s", (_label, init) => {
    expect(getClientIp(h(init as Record<string, string>), TRUSTED)).toBe(UNIDENTIFIED_CLIENT);
  });
});

describe("avertissement en production sans TRUST_PROXY", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetClientIpWarning();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("n'avertit qu'une seule fois", () => {
    getClientIp(h({}), { NODE_ENV: "production" });
    getClientIp(h({}), { NODE_ENV: "production" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("TRUST_PROXY");
  });

  it("n'avertit pas si TRUST_PROXY est défini, ni hors production", () => {
    getClientIp(h({}), { NODE_ENV: "production", TRUST_PROXY: "true" });
    getClientIp(h({}), { NODE_ENV: "development" });
    expect(warn).not.toHaveBeenCalled();
  });
});
