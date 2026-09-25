import { z } from "zod";

// Point d'entrée unique de Zod pour les schémas partagés client/serveur.
// Zod v4 teste `new Function("")` à la création de chaque z.object() pour
// compiler ses validateurs ; la CSP (pas de 'unsafe-eval' en production)
// bloque ce test et le navigateur le signale (kEvalViolation). `jitless`
// supprime le test : validation identique, sans compilation dynamique.
// Doit s'exécuter avant toute définition de schéma : les fichiers de
// lib/schemas importent `z` d'ici, jamais de "zod" directement.
z.config({ jitless: true });

export { z };
