import ReactMarkdown, { type Components } from "react-markdown";

// Rendu du contenu saisi dans l'admin (articles, descriptions). Le Markdown est
// converti en éléments React (rendu serveur, aucun JavaScript côté client) :
//  - jamais de dangerouslySetInnerHTML, et pas de rehype-raw : le HTML brut
//    présent dans le texte est ignoré (skipHtml), jamais interprété ;
//  - liste blanche d'éléments ; tout le reste (dont les images) est retiré ;
//  - liens : http(s) uniquement, ouverts avec rel="noopener noreferrer".
// C'est ce qui compense 'unsafe-inline' dans la CSP des pages publiques.

export const ALLOWED_ELEMENTS = ["p", "h2", "h3", "ul", "ol", "li", "strong", "em", "a", "code", "pre", "blockquote", "br"];

/** Seules les URL http(s) absolues sont conservées ; tout le reste est retiré. */
export function safeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

const components: Components = {
  a: ({ href, children }) =>
    href ? (
      <a href={href} rel="noopener noreferrer" target="_blank" className="text-accent underline underline-offset-2 hover:text-accent-strong">
        {children}
      </a>
    ) : (
      <>{children}</>
    ),
  h2: ({ children }) => <h2 className="mt-10 font-display text-2xl">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-8 font-display text-xl">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc space-y-1.5 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1.5 pl-6">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-accent pl-4 text-ink-soft">{children}</blockquote>,
  code: ({ children }) => <code className="bg-paper px-1 font-mono text-[0.9em]">{children}</code>,
  pre: ({ children }) => <pre className="overflow-x-auto border border-line bg-paper p-4 font-mono text-sm">{children}</pre>,
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown skipHtml allowedElements={ALLOWED_ELEMENTS} unwrapDisallowed urlTransform={safeUrl} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
