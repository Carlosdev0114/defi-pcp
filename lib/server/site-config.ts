import "server-only";
import type { ZodType } from "zod";
import { getRedis } from "@/lib/server/redis";
import {
  assistantSchema,
  DEFAULT_ASSISTANT,
  DEFAULT_MODULES,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  modulesSchema,
  profileSchema,
  settingsSchema,
  type AssistantConfig,
  type Modules,
  type Profile,
  type Settings,
} from "@/lib/schemas/site";

// Configuration du site stockée dans Redis (schéma Prisma imposé, voir
// DATABASE.md). Préfixes distincts : `public:` peut alimenter les pages
// publiques ; `private:` n'est lu que par le back-office (et, pour les
// réglages de l'assistant, par le moteur du chatbot qui les applique).

export const CONFIG_KEYS = {
  profile: "public:profile",
  modules: "public:modules",
  settings: "private:settings",
  assistant: "private:assistant",
} as const;

export type ConfigName = keyof typeof CONFIG_KEYS;

const SCHEMAS: { [K in ConfigName]: ZodType } = {
  profile: profileSchema,
  modules: modulesSchema,
  settings: settingsSchema,
  assistant: assistantSchema,
};

const DEFAULTS = {
  profile: DEFAULT_PROFILE,
  modules: DEFAULT_MODULES,
  settings: DEFAULT_SETTINGS,
  assistant: DEFAULT_ASSISTANT,
};

type ConfigTypes = { profile: Profile; modules: Modules; settings: Settings; assistant: AssistantConfig };

/** Lecture validée : absent, corrompu ou Redis indisponible → valeurs par défaut. */
async function read<K extends ConfigName>(name: K): Promise<ConfigTypes[K]> {
  try {
    const raw = await getRedis().get(CONFIG_KEYS[name]);
    if (raw === null || raw === undefined) return DEFAULTS[name] as ConfigTypes[K];
    const parsed = SCHEMAS[name].safeParse(raw);
    if (parsed.success) return parsed.data as ConfigTypes[K];
    console.error(`site-config: ${CONFIG_KEYS[name]} invalide, valeurs par défaut utilisées`);
  } catch (error) {
    console.error(`site-config: lecture de ${CONFIG_KEYS[name]} impossible`, error);
  }
  return DEFAULTS[name] as ConfigTypes[K];
}

/** Écriture validée (lève si invalide : l'appelant a déjà validé l'entrée). */
async function write<K extends ConfigName>(name: K, value: ConfigTypes[K]): Promise<ConfigTypes[K]> {
  const data = SCHEMAS[name].parse(value) as ConfigTypes[K];
  await getRedis().set(CONFIG_KEYS[name], data);
  return data;
}

export const getProfile = () => read("profile");
export const setProfile = (value: Profile) => write("profile", value);
export const getModules = () => read("modules");
export const setModules = (value: Modules) => write("modules", value);
export const getSettings = () => read("settings");
export const setSettings = (value: Settings) => write("settings", value);
export const getAssistantConfig = () => read("assistant");
export const setAssistantConfig = (value: AssistantConfig) => write("assistant", value);
