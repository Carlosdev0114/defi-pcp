import type { Metadata } from "next";
import { PageHeader } from "@/components/site/PageHeader";
import { ContactForm } from "@/components/site/ContactForm";
import { getProfile } from "@/lib/server/site-config";

export const metadata: Metadata = {
  title: "Contact",
  description: "Pour une mission, une question ou un café.",
};

export default async function ContactPage() {
  const profile = await getProfile();
  const direct = [
    { label: "E-mail", value: profile.email },
    { label: "Téléphone", value: profile.phone },
    { label: "Base", value: profile.location },
  ].filter((d) => d.value);
  const socials = [profile.socials.github, profile.socials.linkedin, profile.socials.mastodon].filter(Boolean);
  return (
    <>
      <PageHeader
        index="06"
        label="Contact"
        title={
          <>
            Dites-moi ce que vous{" "}
            <span className="text-accent">cherchez à faire.</span>
          </>
        }
        lead="Un projet qui vous tient à cœur, une question sur mon approche, ou juste une recommandation à donner ou recevoir : tout passe par ici."
      />

      <div className="page-pad mx-auto grid max-w-6xl gap-12 py-16 lg:grid-cols-[1fr_1.2fr]">
        <aside className="space-y-6">
          <div className="border-2 border-ink bg-cream p-6">
            <p className="label-mono text-accent">Coordonnées directes</p>
            <ul className="mt-4 space-y-3 text-sm">
              {direct.map((d) => (
                <li key={d.label}>
                  <span className="font-mono text-xs text-ink-faint">{d.label}</span>
                  <p className="font-medium">{d.value}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-2 border-ink bg-ink p-6 text-cream">
            <p className="label-mono text-accent">Réponse & délais</p>
            <p className="mt-3 text-sm leading-relaxed text-cream/85">
              Je réponds sous 24 h ouvrées. Si votre besoin est urgent, pensez à
              réserver un créneau : les e-mails passent après les rendez-vous,
              c'est un arbitrage assumé.
            </p>
          </div>

          <div className="border border-dashed border-line-strong p-6">
            <p className="label-mono text-ink-soft">Ailleurs</p>
            <ul className="mt-3 space-y-1.5 font-mono text-sm text-ink">
              {socials.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </aside>

        <ContactForm />
      </div>
    </>
  );
}