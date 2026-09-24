import { contactSchema, type ContactField, type ContactInput } from "@/lib/schemas/contact";
import { requestJson } from "@/lib/http/client";

export type ContactValues = { name: string; email: string; subject: string; message: string; website: string };
export type FieldErrors = Partial<Record<ContactField, string>>;

/** Validation côté client avec LE MÊME schéma que l'API (premier message par champ). */
export function validateContact(
  values: ContactValues
): { data: ContactInput; errors?: never } | { data?: never; errors: FieldErrors } {
  const parsed = contactSchema.safeParse({
    ...values,
    subject: values.subject || undefined,
    website: values.website || undefined,
  });
  if (parsed.success) return { data: parsed.data };
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as ContactField;
    errors[field] ??= issue.message;
  }
  return { errors };
}

export type SendOutcome = { kind: "sent" } | { kind: "error"; error: string; retryAfter: number | null };

export async function sendContact(data: ContactInput): Promise<SendOutcome> {
  const result = await requestJson<{ ok: true }>("/api/contact", { method: "POST", body: JSON.stringify(data) });
  return result.ok ? { kind: "sent" } : { kind: "error", error: result.error, retryAfter: result.retryAfter };
}
