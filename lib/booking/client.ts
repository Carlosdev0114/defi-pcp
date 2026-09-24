import { requestJson } from "@/lib/http/client";
import { zonedToUtc } from "@/lib/time/paris";
import type { BookingInput } from "@/lib/schemas/booking";
import type { AppointmentStatus } from "@/lib/booking/status";

// --- Parcours visiteur (routes publiques) ------------------------------------

export type PublicService = { id: string; name: string; durationMin: number; description: string | null };
export type DayAvailability = { date: string; count: number };
export type Slot = { startAt: string; endAt: string; time: string };
export type BookedAppointment = {
  reference: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  service: string;
};

export const BOOKING_DAYS = 14;

export const fetchServices = () => requestJson<{ items: PublicService[] }>("/api/public/services?pageSize=50");

export const fetchAvailability = (serviceId: string, days = BOOKING_DAYS) =>
  requestJson<{ from: string; items: DayAvailability[] }>(
    `/api/public/availability?${new URLSearchParams({ serviceId, days: String(days) })}`
  );

export const fetchSlots = (serviceId: string, date: string) =>
  requestJson<{ items: Slot[] }>(`/api/public/slots?${new URLSearchParams({ serviceId, date })}`);

export const createAppointment = (input: BookingInput) =>
  requestJson<{ ok: true; appointment: BookedAppointment }>("/api/appointments", {
    method: "POST",
    body: JSON.stringify(input),
  });

// --- Back-office (routes admin, 401 sans session) ----------------------------

export const APPOINTMENTS_PAGE_SIZE = 20;

export type AdminAppointment = {
  id: string;
  reference: string;
  visitorName: string;
  visitorEmail: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  notes: string | null;
  service: { id: string; name: string; durationMin: number };
};

export type AppointmentsPage = {
  items: AdminAppointment[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: Record<AppointmentStatus, number>;
};

export function appointmentsUrl({ status, page }: { status: AppointmentStatus | null; page: number }) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(APPOINTMENTS_PAGE_SIZE) });
  if (status) params.set("status", status);
  return `/api/admin/appointments?${params}`;
}

export const fetchAppointments = (query: { status: AppointmentStatus | null; page: number }) =>
  requestJson<AppointmentsPage>(appointmentsUrl(query));

export const setAppointmentStatus = (id: string, status: AppointmentStatus) =>
  requestJson<unknown>(`/api/admin/appointments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export type CalendarBlock = { id: string; title: string; startAt: string; endAt: string; blocked: boolean };
export type BlocksPage = { items: CalendarBlock[]; page: number; totalPages: number; total: number };

/** Blocages à venir (ceux qui se terminent après maintenant). */
export const fetchBlocks = (page: number) =>
  requestJson<BlocksPage>(
    `/api/admin/calendar-events?${new URLSearchParams({ page: String(page), pageSize: "10", from: new Date().toISOString() })}`
  );

/** Saisie en heure de Paris (date + heures locales) → instants UTC pour l'API. */
export function blockToApi(input: { title: string; date: string; start: string; end: string }) {
  return {
    title: input.title,
    startAt: zonedToUtc(input.date, input.start).toISOString(),
    endAt: zonedToUtc(input.date, input.end).toISOString(),
    blocked: true,
  };
}

export const createBlock = (input: { title: string; date: string; start: string; end: string }) =>
  requestJson<CalendarBlock>("/api/admin/calendar-events", { method: "POST", body: JSON.stringify(blockToApi(input)) });

export const deleteBlock = (id: string) =>
  requestJson<null>(`/api/admin/calendar-events/${encodeURIComponent(id)}`, { method: "DELETE" });
