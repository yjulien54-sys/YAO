/* eslint-disable @next/next/no-img-element */
/**
 * Affiche de la cagnotte (l'image que WhatsApp, Facebook… montrent quand on partage le lien).
 * Photo, logo Sikaklo, motif, titre, montant, jauge et logos des opérateurs, aux couleurs de Sikaklo.
 * Renvoie un JPEG léger (environ 100 Ko) : WhatsApp refuse les images trop lourdes.
 */
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { phraseMotif } from "@/lib/motif";
import { THEMES, themePour } from "@/lib/themesAffiche";

export type InfosAffiche = { id?: string; theme?: number | null; nom: string; cause: string | null; message: string | null; description: string | null; photo: string | null; objectif: number | null; collecte: number; donateurs_nb: number; tresorier: string | null };

const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, " ")} F CFA`;
const size = { width: 1200, height: 630 };

export async function dessinerAffiche(c: InfosAffiche | null): Promise<{ data: Buffer; type: "image/jpeg" | "image/png" }> {
  // Fichiers locaux : si l'un manque, l'image se fabrique quand même (police par défaut, sans logo)
  const lire = (chemin: string) => readFile(join(process.cwd(), chemin)).catch(() => null);
  const [icone, gras, moyen] = await Promise.all([lire("public/icons/icon-192.png"), lire("public/polices/PlusJakartaSans-ExtraBold.ttf"), lire("public/polices/PlusJakartaSans-Medium.ttf")]);
  const ops = (await Promise.all(["wave", "orange", "mtn", "moov"].map((n) => lire(`public/operateurs/${n}.png`))))
    .flatMap((b) => (b ? [`data:image/png;base64,${b.toString("base64")}`] : []));
  const logo = icone ? `data:image/png;base64,${icone.toString("base64")}` : null;
  const pct = c?.objectif ? Math.min(100, Math.round((c.collecte / c.objectif) * 100)) : null;
  const titre = c?.nom ?? "Cagnotte Sikaklo";
  // Titre : plus il est long, plus il est petit (3 lignes maximum, jamais sur le montant)
  // Le motif : une phrase courte qui explique pourquoi on collecte (tirée du message du trésorier)
  const motifTexte = phraseMotif(c?.message ?? c?.description, 95);
  const taille = motifTexte
    ? (titre.length > 52 ? 34 : titre.length > 34 ? 40 : 50)
    : (titre.length > 70 ? 36 : titre.length > 52 ? 40 : titre.length > 34 ? 48 : 58);
  const lignesTitre = motifTexte ? 2 : 3;

  // Le style du groupe (toujours le même pour un groupe donné)
  const t = THEMES[themePour(c?.id, c?.theme)];
  const motif = Array.from({ length: 48 }, (_, k) => t.motif[k % t.motif.length]);

  const png = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: t.fond, fontFamily: "Jakarta", fontWeight: 500 }}>
        {/* Photo */}
        <div style={{ width: 560, height: "100%", display: "flex", position: "relative", background: t.panneau }}>
          {c?.photo
            ? <img src={c.photo} alt="" width={560} height={630} style={{ width: 560, height: 630, objectFit: "cover" }} />
            : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {logo ? <img src={logo} alt="" width={200} height={200} style={{ borderRadius: 48 }} /> : <span style={{ fontSize: 96, fontWeight: 800, color: t.texte }}>Sikaklo</span>}
              </div>
            )}
          <div style={{ position: "absolute", top: 0, right: 0, width: 12, height: "100%", display: "flex", flexDirection: "column" }}>
            {motif.slice(0, 18).map((col, k) => <div key={k} style={{ flex: 1, background: col }} />)}
          </div>
        </div>

        {/* Texte */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "48px 56px 0 52px", color: t.texte, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {logo && <img src={logo} alt="" width={64} height={64} style={{ borderRadius: 16 }} />}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>Sikaklo</span>
              <span style={{ fontSize: 18, color: t.etiquette, letterSpacing: 3 }}>CAGNOTTE</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 24 }}>
            {c?.cause && <span style={{ fontSize: 22, fontWeight: 700, color: t.accent, letterSpacing: 3, textTransform: "uppercase" }}>{c.cause}</span>}
            <span style={{ fontSize: taille, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1, marginTop: 8, maxHeight: taille * 1.1 * lignesTitre, overflow: "hidden" }}>{titre}</span>
            {motifTexte && <span style={{ fontSize: 23, lineHeight: 1.3, color: t.texte2, marginTop: 12, maxHeight: 23 * 1.3 * 2, overflow: "hidden" }}>{motifTexte}</span>}
          </div>

          {c && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: 40, paddingTop: 14 }}>
              <span style={{ fontSize: 44, fontWeight: 800, color: t.texte, letterSpacing: -1 }}>{fcfa(c.collecte)}</span>
              <span style={{ fontSize: 22, color: t.texte2, marginTop: 2 }}>
                {c.objectif ? `collectés sur ${fcfa(c.objectif)}` : "collectés"} · {c.donateurs_nb} participant{c.donateurs_nb > 1 ? "s" : ""}
              </span>
              {pct != null && (
                <div style={{ display: "flex", marginTop: 18, width: "100%", height: 16, borderRadius: 999, background: t.piste }}>
                  <div style={{ width: `${Math.max(pct, 3)}%`, height: 16, borderRadius: 999, background: `linear-gradient(90deg, ${t.jauge[0]}, ${t.jauge[1]})` }} />
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", marginTop: 26, gap: 16 }}>
                <div style={{ display: "flex", background: t.bouton, color: t.boutonTexte, fontSize: 26, fontWeight: 800, padding: "14px 34px", borderRadius: 999 }}>Participer</div>
                {ops.length === 4
                  ? <div style={{ display: "flex", gap: 10 }}>{ops.map((src, k) => <img key={k} src={src} alt="" width={50} height={50} style={{ borderRadius: 12, background: "white", border: "2px solid rgba(0,0,0,0.06)" }} />)}</div>
                  : <span style={{ fontSize: 20, color: t.texte2 }}>Wave · Orange · MTN · Moov</span>}
              </div>
            </div>
          )}

          {/* Motifs en bas */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 14, display: "flex" }}>
            {motif.slice(0, 24).map((col, k) => <div key={k} style={{ flex: 1, background: col }} />)}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: gras && moyen ? [{ name: "Jakarta", data: gras, weight: 800, style: "normal" }, { name: "Jakarta", data: moyen, weight: 500, style: "normal" }] : undefined },
  );
  const brut = Buffer.from(await png.arrayBuffer());
  try {
    return { data: await sharp(brut).jpeg({ quality: 80, mozjpeg: true, chromaSubsampling: "4:2:0" }).toBuffer(), type: "image/jpeg" };
  } catch {
    return { data: brut, type: "image/png" };
  }
}
