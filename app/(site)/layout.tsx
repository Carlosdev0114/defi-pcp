import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { WidgetStack } from "@/components/widgets/WidgetStack";
import { VisitBeacon } from "@/components/site/VisitBeacon";
import { getModules } from "@/lib/server/site-config";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Assistant désactivé dans les paramètres : widget masqué (et /api/chat répond 503).
  const { chat } = await getModules();
  return (
    <>
      <SiteNav />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <WidgetStack chatEnabled={chat} />
      <VisitBeacon />
    </>
  );
}