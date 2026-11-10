/**
 * Verrou de l'application : code secret à 4 chiffres + empreinte (ou visage) du téléphone.
 * Le code n'est jamais enregistré en clair : seule son empreinte chiffrée (SHA-256 salé) est gardée sur l'appareil.
 */

type Verrou = { sel: string; hash: string; cred?: string };
type Essais = { n: number; jusqua?: number };

const cle = (uid: string) => `cotiz:verrou:${uid}`;
const cleEssais = (uid: string) => `cotiz:verrou-essais:${uid}`;
export const CLE_SESSION = "cotiz:deverrouille";
export const ESSAIS_MAX = 5;
export const ATTENTE_MS = 60_000;

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
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hacher(code: string, sel: string, uid: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${sel}:${uid}:${code}`)));
}

export const lireVerrou = (uid: string) => lire<Verrou>(cle(uid));
export const aUnCode = (uid: string) => !!lireVerrou(uid)?.hash;
export const aEmpreinte = (uid: string) => !!lireVerrou(uid)?.cred;

export async function definirCode(uid: string, code: string) {
  const sel = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  ecrire(cle(uid), { ...lireVerrou(uid), sel, hash: await hacher(code, sel, uid) });
  ecrire(cleEssais(uid), null);
}

export function supprimerVerrou(uid: string) {
  ecrire(cle(uid), null);
  ecrire(cleEssais(uid), null);
}

/** Bloqué après trop d'erreurs ? Renvoie le nombre de secondes restantes (0 = non bloqué) */
export function attenteRestante(uid: string) {
  const e = lire<Essais>(cleEssais(uid));
  if (!e?.jusqua) return 0;
  const reste = e.jusqua - Date.now();
  if (reste <= 0) {
    ecrire(cleEssais(uid), null);
    return 0;
  }
  return Math.ceil(reste / 1000);
}

/** Vérifie le code. Renvoie ok, ou le nombre d'essais restants */
export async function verifierCode(uid: string, code: string): Promise<{ ok: boolean; restants: number }> {
  const v = lireVerrou(uid);
  if (!v) return { ok: false, restants: ESSAIS_MAX };
  if ((await hacher(code, v.sel, uid)) === v.hash) {
    ecrire(cleEssais(uid), null);
    return { ok: true, restants: ESSAIS_MAX };
  }
  const e = lire<Essais>(cleEssais(uid)) ?? { n: 0 };
  const n = e.n + 1;
  if (n >= ESSAIS_MAX) {
    ecrire(cleEssais(uid), { n: 0, jusqua: Date.now() + ATTENTE_MS });
    return { ok: false, restants: 0 };
  }
  ecrire(cleEssais(uid), { n });
  return { ok: false, restants: ESSAIS_MAX - n };
}

/* ---------- Empreinte / visage du téléphone (WebAuthn, capteur de l'appareil) ---------- */

export async function empreinteDisponible() {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Associe l'empreinte du téléphone au compte (le téléphone demande le doigt ou le visage) */
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
  const v = lireVerrou(uid);
  if (v) ecrire(cle(uid), { ...v, cred: b64(cred.rawId) });
}

export function desactiverEmpreinte(uid: string) {
  const v = lireVerrou(uid);
  if (v) ecrire(cle(uid), { ...v, cred: undefined });
}

/** Demande l'empreinte au téléphone. Renvoie true si c'est bien la bonne personne */
export async function verifierEmpreinte(uid: string) {
  const v = lireVerrou(uid);
  if (!v?.cred) return false;
  try {
    const r = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: deB64(v.cred) }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return !!r;
  } catch {
    return false;
  }
}
