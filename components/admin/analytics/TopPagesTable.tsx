import { Panel } from "@/components/admin/ui";

export function TopPagesTable({ pages, total }: { pages: { path: string; views: number }[]; total: number }) {
  return (
    <Panel title="Pages les plus vues (30 j)">
      {pages.length === 0 ? <p className="text-sm text-ink-faint">Aucune page vue sur la période.</p> : null}
      <table className="w-full text-left text-sm">
        <tbody className="divide-y divide-line">
          {pages.map((p) => (
            <tr key={p.path}>
              <td className="py-2.5 font-mono text-xs">{p.path}</td>
              <td className="py-2.5 text-right font-mono text-xs">{p.views.toLocaleString("fr-FR")}</td>
              <td className="py-2.5 pl-3 text-right font-mono text-xs text-accent">{total ? Math.round((p.views / total) * 100) : 0} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
