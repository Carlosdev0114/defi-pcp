import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import { getProfile } from "@/lib/server/site-config";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

/** Titre et description tirés du profil (Redis), revalidés avec lui. */
export async function generateMetadata(): Promise<Metadata> {
  const profile = await getProfile();
  const name = profile.name || "Portfolio";
  return {
    title: { default: profile.role ? `${name} — ${profile.role}` : name, template: `%s — ${name}` },
    description: profile.baseline || profile.shortBio || undefined,
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#contenu"
          className="sr-only z-50 bg-ink px-4 py-2 font-mono text-xs text-cream focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}