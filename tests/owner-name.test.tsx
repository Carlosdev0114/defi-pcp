import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatPanel } from "@/components/widgets/ChatPanel";
import { VisitorThread } from "@/components/widgets/messaging/VisitorThread";
import { PortraitPlaceholder } from "@/components/site/PortraitPlaceholder";

// Le nom affiché dans les widgets et sur le portrait vient du profil
// (jamais codé en dur), avec une formulation neutre s'il est vide.

const noop = () => {};
const reply = { id: "m1", sender: "ADMIN" as const, content: "Bonjour", createdAt: "2026-09-25T08:00:00.000Z" };

describe("nom du propriétaire lu dans le profil", () => {
  it("assistant : titre et message d'accueil au nom du profil", () => {
    const html = renderToStaticMarkup(<ChatPanel onClose={noop} ownerName="Aguidissou Carlos" />);
    expect(html).toContain("Assistant de Aguidissou Carlos");
    expect(html).toContain("les compétences de Aguidissou Carlos");
  });

  it("assistant : formulation neutre si le nom est vide", () => {
    const html = renderToStaticMarkup(<ChatPanel onClose={noop} ownerName="" />);
    expect(html).toContain("Assistant du portfolio");
    expect(html).toContain("de la personne présentée ici");
  });

  it("messagerie : les réponses sont signées du nom du profil, ou « Réponse »", () => {
    expect(renderToStaticMarkup(<VisitorThread messages={[reply]} ownerName="Aguidissou Carlos" />)).toContain("Aguidissou Carlos ·");
    expect(renderToStaticMarkup(<VisitorThread messages={[reply]} ownerName="" />)).toContain("Réponse ·");
  });

  it("portrait : espace réservé dont le libellé suit le nom", () => {
    expect(renderToStaticMarkup(<PortraitPlaceholder name="Aguidissou Carlos" />)).toContain('aria-label="Portrait de Aguidissou Carlos (photo à venir)"');
    expect(renderToStaticMarkup(<PortraitPlaceholder name="" />)).toContain('aria-label="Portrait (photo à venir)"');
  });
});
