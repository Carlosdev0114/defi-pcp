import { Button } from "@/components/ui/buttons";

export function ContactSuccess({ name, onReset }: { name: string; onReset: () => void }) {
  return (
    <div className="border-2 border-ink bg-cream p-8" role="status">
      <p className="label-mono text-accent">Message envoyé</p>
      <h2 className="mt-3 font-display text-3xl">Merci {name}, on se reparle vite.</h2>
      <p className="mt-3 leading-relaxed text-ink-soft">
        Votre message est bien arrivé. Je réponds sous 24 h ouvrées, à l'adresse
        e-mail que vous avez indiquée.
      </p>
      <Button variant="outline" className="mt-6" onClick={onReset}>
        Envoyer un autre message
      </Button>
    </div>
  );
}
