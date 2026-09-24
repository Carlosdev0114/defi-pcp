import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { Redis } from "@upstash/redis";
import { hash } from "bcryptjs";
import sharp from "sharp";
// Node ≥ 22.18 exécute ces modules TypeScript directement (types effacés) :
// le seed valide ses données avec les MÊMES schémas que l'API.
import { articleCreateSchema, experienceCreateSchema, projectCreateSchema, skillCreateSchema } from "../lib/schemas/content.ts";
import { profileSchema } from "../lib/schemas/site.ts";

// Contenu initial : prisma/seed-data.json (plus aucun mock dans le code).
// Toutes les écritures de contenu sont « create-only » : relancer le seed ne
// réécrase jamais une modification faite depuis le back-office. Seul le mot
// de passe admin est resynchronisé.
//
// Production (images dans le Blob store) :
//   STORAGE_DRIVER=vercel-blob BLOB_READ_WRITE_TOKEN=… npm run db:seed

const db = new PrismaClient();
const data = JSON.parse(await readFile(new URL("./seed-data.json", import.meta.url), "utf8"));

// --- Stockage des médias (même contrat que lib/server/storage) -------------

function storage() {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "local") {
    const dir = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"));
    return {
      driver,
      async put(key, buffer) {
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, key), buffer, { flag: "wx" });
      },
    };
  }
  if (driver === "vercel-blob") {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("BLOB_READ_WRITE_TOKEN manquant pour STORAGE_DRIVER=vercel-blob.");
    return {
      driver,
      async put(key, buffer, contentType) {
        const { put } = await import("@vercel/blob");
        await put(`media/${key}`, buffer, {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType,
          cacheControlMaxAge: 60 * 60 * 24 * 365,
          token,
        });
      },
    };
  }
  throw new Error(`STORAGE_DRIVER inconnu : « ${driver} » (attendu : local | vercel-blob).`);
}

/** SVG du dépôt → WebP (1600 px max) → stockage ; renvoie les champs de Media. */
async function storeCover(file) {
  const input = await readFile(path.join(process.cwd(), file));
  const { data: webp, info } = await sharp(input, { density: 144 })
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const key = `${randomUUID()}.webp`;
  await store.put(key, webp, "image/webp");
  return { url: key, mimeType: "image/webp", width: info.width, height: info.height, sizeBytes: info.size };
}

const store = storage();

// --- Étapes ----------------------------------------------------------------

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 8) {
    console.error("Seed interrompu : ADMIN_EMAIL + ADMIN_PASSWORD (>= 8 caractères) requis dans .env.");
    process.exit(1);
  }
  const passwordHash = await hash(password, 10);
  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN" },
    create: { email, passwordHash, name: data.profile.name, role: "ADMIN" },
  });
  console.log(`Admin prêt : ${user.email} — ${user.role}`);
}

const redis = process.env.REDIS_URL && process.env.REDIS_TOKEN
  ? new Redis({ url: process.env.REDIS_URL, token: process.env.REDIS_TOKEN })
  : null;

/** Profil public dans Redis, écrit seulement s'il est absent (jamais d'écrasement). */
async function seedProfile() {
  if (!redis) return console.warn("Profil : REDIS_URL / REDIS_TOKEN absents, étape ignorée.");
  const profile = profileSchema.parse(data.profile);
  const created = await redis.set("public:profile", profile, { nx: true });
  console.log(`Profil : ${created ? "créé" : "déjà présent (conservé)"}`);
}

/** Même effet qu'une écriture admin : cache public périmé, index RAG à reconstruire. */
async function invalidateCaches() {
  if (!redis) return;
  await Promise.all([
    ...["projects", "experiences", "skills", "articles", "services", "slots"].map((r) => redis.incr(`cachever:${r}`)),
    redis.set("rag:stale", "1"),
  ]);
  console.log("Cache public invalidé, index RAG marqué périmé.");
}

async function seedProjects() {
  let covers = 0;
  for (const { cover, ...raw } of data.projects) {
    const p = projectCreateSchema.parse(raw);
    const project = await db.project.upsert({
      where: { slug: p.slug },
      update: {},
      create: { ...p, publishedAt: p.publishedAt ? new Date(p.publishedAt) : null },
    });
    // Couverture créée seulement si le projet n'a encore aucun média.
    if (cover && (await db.media.count({ where: { projectId: project.id } })) === 0) {
      await db.media.create({ data: { ...(await storeCover(cover.file)), altText: cover.alt, projectId: project.id } });
      covers++;
    }
  }
  console.log(`Projets : ${data.projects.length} (${covers} couverture(s) créée(s), stockage ${store.driver})`);
}

async function seedExperiences() {
  for (const raw of data.experiences) {
    const x = experienceCreateSchema.parse(raw);
    if (await db.experience.findFirst({ where: { company: x.company, title: x.title } })) continue;
    await db.experience.create({
      data: { ...x, startDate: new Date(x.startDate), endDate: x.endDate ? new Date(x.endDate) : null },
    });
  }
  console.log(`Expériences : ${data.experiences.length}`);
}

async function seedSkills() {
  for (const raw of data.skills) {
    const s = skillCreateSchema.parse(raw);
    await db.skill.upsert({ where: { name: s.name }, update: {}, create: s });
  }
  console.log(`Compétences : ${data.skills.length}`);
}

async function seedArticles() {
  for (const raw of data.articles) {
    const a = articleCreateSchema.parse(raw);
    await db.article.upsert({
      where: { slug: a.slug },
      update: {},
      create: { ...a, publishedAt: a.publishedAt ? new Date(a.publishedAt) : null },
    });
  }
  console.log(`Articles : ${data.articles.length}`);
}

async function seedServices() {
  for (const s of data.services) {
    let service = await db.service.findFirst({ where: { name: s.name } });
    if (!service) {
      service = await db.service.create({
        data: { name: s.name, durationMin: s.durationMin, description: s.description, active: s.active },
      });
    }
    if ((await db.availability.count({ where: { serviceId: service.id } })) === 0) {
      await db.availability.createMany({ data: s.availability.map((w) => ({ ...w, serviceId: service.id })) });
    }
  }
  console.log(`Services : ${data.services.length} (+ disponibilités)`);
}

async function main() {
  await seedAdmin();
  await seedProfile();
  await seedProjects();
  await seedExperiences();
  await seedSkills();
  await seedArticles();
  await seedServices();
  await invalidateCaches();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
