/**
 * Code secret de l'application Cotiz (4 chiffres), indépendant du verrouillage du téléphone.
 *
 * - Le code est enregistré dans la base Cotiz, chiffré de façon irréversible (personne ne peut le lire).
 * - Une copie chiffrée est gardée sur le téléphone pour pouvoir ouvrir l'application sans connexion.
 * - Tant que la mise à jour SQL n°8 n'est pas installée, seul le téléphone garde le code.
 * - Code oublié : l'équipe Cotiz le réinitialise, puis la personne en crée un nouveau.
 */
import { supabase } from "./supabase";

type Local = { sel: string; hash: string };
type Essais = { n: number; jusqua?: number };
export type Etat = { defini: boolean; modifieLe?: string; attente: number; serveur: boolean };
export type Resultat = { ok: boolean; restants: number; attente: number; erreur?: string };

const cle = (uid: string) => `cotiz:verrou:${uid}`;
const cleEssais = (uid: string) => `cotiz:verrou-essais:${uid}`;
export const CLE_SESSION = "cotiz:deverrouille";
export const ESSAIS_MAX = 5;

const lire = <T,>(k: string): T | null => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const ecrire = (k: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const hacher = async (code: string, sel: string, uid: string) =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${sel}:${uid}:${code}`)));

async function copieLocale(uid: string, code: string) {
  const sel = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  ecrire(cle(uid), { sel, hash: await hacher(code, sel, uid) });
}

/** La fonction SQL n'existe pas encore (mise à jour n°8 pas installée) */
const absente = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? ""));
/** Pas de réseau : on se rabat sur la copie du téléphone */
const horsLigne = (e: { message?: string } | null) => !!e && /fetch|network|failed/i.test(e.message ?? "");

/* ---------- Mode téléphone seul (sans la mise à jour n°8, ou hors connexion) ---------- */

function attenteLocale(uid: string) {
  const e = lire<Essais>(cleEssais(uid));
  if (!e?.jusqua) return 0;
  const reste = e.jusqua - Date.now();
  if (reste <= 0) return ecrire(cleEssais(uid), null), 0;
  return Math.ceil(reste / 1000);
}

async function verifierLocal(uid: string, code: string): Promise<Resultat> {
  const attente = attenteLocale(uid);
  if (attente) return { ok: false, restants: 0, attente };
  const v = lire<Local>(cle(uid));
  if (v && (await hacher(code, v.sel, uid)) === v.hash) {
    ecrire(cleEssais(uid), null);
    return { ok: true, restants: ESSAIS_MAX, attente: 0 };
  }
  const n = (lire<Essais>(cleEssais(uid))?.n ?? 0) + 1;
  if (n >= ESSAIS_MAX) {
    ecrire(cleEssais(uid), { n: 0, jusqua: Date.now() + 60_000 });
    return { ok: false, restants: 0, attente: 60 };
  }
  ecrire(cleEssais(uid), { n });
  return { ok: false, restants: ESSAIS_MAX - n, attente: 0 };
}

/* ---------- Fonctions utilisées par l'application ---------- */

export async function etatCode(uid: string): Promise<Etat> {
  const { data, error } = await supabase.rpc("code_etat");
  if (!error && data) {
    const d = data as { defini: boolean; modifie_le?: string; attente: number };
    // Code réinitialisé par l'équipe Cotiz : on efface aussi la copie du téléphone
    if (!d.defini) ecrire(cle(uid), null);
    return { defini: d.defini, modifieLe: d.modifie_le ?? undefined, attente: d.attente ?? 0, serveur: true };
  }
  return { defini: !!lire<Local>(cle(uid)), attente: attenteLocale(uid), serveur: false };
}

/** Créer ou changer le code (ancien = code actuel, obligatoire pour un changement) */
export async function definirCode(uid: string, nouveau: string, ancien?: string): Promise<{ ok: boolean; erreur?: string }> {
  const { data, error } = await supabase.rpc("definir_code", { nouveau, ancien: ancien ?? null });
  if (!error) {
    const d = data as { ok: boolean; erreur?: string };
    if (d.ok) await copieLocale(uid, nouveau);
    return d;
  }
  if (!absente(error)) return { ok: false, erreur: horsLigne(error) ? "Pas de connexion. Réessaie quand tu as du réseau." : error.message };
  // Sans la mise à jour n°8 : le code reste sur le téléphone
  if (ancien !== undefined && lire<Local>(cle(uid)) && !(await verifierLocal(uid, ancien)).ok) return { ok: false, erreur: "Ancien code incorrect" };
  await copieLocale(uid, nouveau);
  ecrire(cleEssais(uid), null);
  return { ok: true };
}

export async function verifierCode(uid: string, code: string): Promise<Resultat> {
  const { data, error } = await supabase.rpc("verifier_code", { code });
  if (!error && data) {
    const d = data as { ok: boolean; restants: number; attente: number };
    if (d.ok) await copieLocale(uid, code);
    return { ok: d.ok, restants: d.restants, attente: d.attente };
  }
  return verifierLocal(uid, code);
}

/** Déconnexion : on efface la copie du code sur le téléphone */
export function oublierSurCeTelephone(uid: string) {
  ecrire(cle(uid), null);
  ecrire(cleEssais(uid), null);
  ecrire(`cotiz:empreinte:${uid}`, null);
}

/* ---------- Empreinte (ou visage) : option propre à ce téléphone ---------- */

const cleEmpreinte = (uid: string) => `cotiz:empreinte:${uid}`;
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const aEmpreinte = (uid: string) => !!lire<string>(cleEmpreinte(uid));

export async function empreinteDisponible() {
  try {
    return typeof window !== "undefined" && !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Associe l'empreinte de ce téléphone au compte Cotiz (le téléphone demande le doigt) */
export async function activerEmpreinte(uid: string, nom: string, tel: string) {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Cotiz" },
      user: { id: new TextEncoder().encode(uid).slice(0, 64), name: tel || nom, displayName: nom },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Empreinte non enregistrée");
  ecrire(cleEmpreinte(uid), b64(cred.rawId));
}

export const desactiverEmpreinte = (uid: string) => ecrire(cleEmpreinte(uid), null);

/** Demande l'empreinte au téléphone : true si c'est bien la personne */
export async function verifierEmpreinte(uid: string) {
  const id = lire<string>(cleEmpreinte(uid));
  if (!id) return false;
  try {
    return !!(await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: deB64(id) }],
        userVerification: "required",
        timeout: 60_000,
      },
    }));
  } catch {
    return false;
  }
}
