import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Neon (offre serverless) se met en veille après une période sans requête, et
// le polling temps réel est conçu pour le laisser dormir. Le premier accès
// après une veille peut prendre plusieurs secondes : avec le délai par défaut
// de Prisma (2 s pour obtenir une connexion de transaction), la première
// écriture échouait en P2028. On laisse donc 10 s pour démarrer une
// transaction et 15 s pour l'exécuter.
export const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 } as const;

export const db = globalForPrisma.prisma ?? new PrismaClient({ transactionOptions: TRANSACTION_OPTIONS });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
