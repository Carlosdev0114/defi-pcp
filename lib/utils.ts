export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatMonth(start: string, end: string | null) {
  const fmt = (iso: string) => {
    const [y, m] = iso.split("-");
    const months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    return `${months[Number(m) - 1]} ${y}`;
  };
  return `${fmt(start)} — ${end ? fmt(end) : "aujourd'hui"}`;
}

export function formatDate(iso: string) {
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}