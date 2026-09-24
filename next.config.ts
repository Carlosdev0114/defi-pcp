import type { NextConfig } from "next";
import { buildCsp, cspOptionsFromEnv, PUBLIC_CSP_SOURCE } from "./lib/csp";

const isDev = process.env.NODE_ENV !== "production";

// CSP des pages PUBLIQUES (statiques, en cache CDN) : variante sans nonce de
// lib/csp.ts. /admin et /login reçoivent la variante stricte à nonce depuis
// proxy.ts, et sont donc exclues de cet en-tête (PUBLIC_CSP_SOURCE).
// Le domaine Vercel Blob n'est autorisé dans img-src que si
// STORAGE_DRIVER=vercel-blob (lu au build, comme les autres variables Vercel).
const publicCsp = buildCsp(cspOptionsFromEnv());

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS seulement en production : en local (http) il bloquerait localhost.
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Toutes nos images sont des SVG locaux faits main (portrait, pochettes,
    // illustrations) : on doit autoriser l'optimiseur à les servir.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  serverExternalPackages: ["@prisma/client", "bcryptjs", "sharp"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: PUBLIC_CSP_SOURCE, headers: [{ key: "Content-Security-Policy", value: publicCsp }] },
    ];
  },
};

export default nextConfig;
