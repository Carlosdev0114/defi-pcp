import { unstable_rethrow } from "next/navigation";
import { AdminPage, PageTitle, Tag } from "@/components/admin/ui";
import { getVisitStats, type VisitStats } from "@/lib/server/visits";
import { DailyViewsChart } from "@/components/admin/analytics/DailyViewsChart";
import { TopPagesTable } from "@/components/admin/analytics/TopPagesTable";

async function loadStats(): Promise<VisitStats | null> {
  try {
    return await getVisitStats(30);
  } catch (error) {
    unstable_rethrow(error); // signaux internes de Next (rendu dynamique…) : pas une panne
    console.error("Statistiques indisponibles", error);
    return null;
  }
}

/** Fréquentation : pages vues comptées côté serveur (compteurs Redis), sans
 * cookie, sans IP, sans outil externe. Pas de visiteurs uniques. */
export default async function AdminAnalyticsPage() {
  const stats = await loadStats();
  const today = stats?.days[stats.days.length - 1]?.views ?? 0;

  return (
    <AdminPage>
      <PageTitle
        eyebrow="Système · Statistiques"
        title="Fréquentation"
        description="Pages vues par jour et par page, comptées côté serveur sans cookie ni adresse IP. Il s'agit de pages vues, pas de visiteurs uniques ; les robots sont ignorés."
        actions={<Tag tone="ok">Données réelles</Tag>}
      />

      {!stats ? (
        <p className="border-2 border-accent bg-accent/10 p-4 font-mono text-sm text-accent-ink" role="alert">
          Les compteurs sont momentanément indisponibles.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Pages vues / 30 j", value: stats.total.toLocaleString("fr-FR") },
              { label: "Moyenne / jour", value: (stats.total / 30).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) },
              { label: "Aujourd'hui", value: today.toLocaleString("fr-FR") },
              { label: "30 j précédents", value: stats.previousTotal.toLocaleString("fr-FR") },
            ].map((s) => (
              <div key={s.label} className="border-2 border-ink bg-cream p-5">
                <p className="label-mono text-ink-faint">{s.label}</p>
                <p className="mt-2 font-display text-4xl text-accent">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <DailyViewsChart days={stats.days} />
            <TopPagesTable pages={stats.topPages} total={stats.total} />
          </div>
        </>
      )}
    </AdminPage>
  );
}
