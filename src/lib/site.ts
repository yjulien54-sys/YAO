/**
 * Adresse officielle du site Sikaklo : c'est elle qu'on met dans les liens partagés
 * (WhatsApp, affiches, Google…). L'ancienne adresse tontine-et-cotise.vercel.app
 * continue de marcher pour les anciens liens et l'application déjà installée.
 */
const env = process.env.NEXT_PUBLIC_SITE_URL;
export const SITE = env && !env.includes("tontine-et-cotise") ? env.replace(/\/$/, "") : "https://www.sikaklo.com";
export const SITE_COURT = SITE.replace(/^https?:\/\//, "").replace(/^www\./, "");
