const nf = new Intl.NumberFormat("fr-FR");

export const fcfa = (n: number) => `${nf.format(Math.round(n)).replace(/ | /g, " ")} F`;

export const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

export const dateLongue = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const initiales = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

export const prenom = (name: string) => name.split(/\s+/)[0] ?? name;

/** Numéro ivoirien au format international sans "+" : 2250707123456 */
export const normaliserTel = (tel: string) => {
  const d = tel.replace(/\D/g, "");
  if (d.startsWith("225")) return d;
  if (d.startsWith("00225")) return d.slice(2);
  return `225${d}`;
};

export const telAffiche = (tel: string) => {
  const d = normaliserTel(tel).slice(3);
  return d.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const reference = () =>
  "CTZ-" + Math.random().toString(36).slice(2, 8).toUpperCase();
