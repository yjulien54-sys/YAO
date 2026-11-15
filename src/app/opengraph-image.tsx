/**
 * Affiche générale de Sikaklo : l'image qui apparaît quand on partage n'importe quel lien Sikaklo
 * (invitation dans un groupe, lien de l'application…). Fabriquée une seule fois, au déploiement.
 */
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Sikaklo : tontines, associations et collectes, sans palabres";
export const size = { width: 1200, height: 630 };
// JPEG léger : WhatsApp n'affiche pas les images trop lourdes
export const contentType = "image/jpeg";

export default async function Image() {
  const lire = (chemin: string) => readFile(join(process.cwd(), chemin)).catch(() => null);
  const [icone, gras, moyen] = await Promise.all([lire("public/icons/icon-192.png"), lire("public/polices/PlusJakartaSans-ExtraBold.ttf"), lire("public/polices/PlusJakartaSans-Medium.ttf")]);
  const ops = (await Promise.all(["wave", "orange", "mtn", "moov"].map((n) => lire(`public/operateurs/${n}.png`)))).flatMap((b) => (b ? [`data:image/png;base64,${b.toString("base64")}`] : []));
  const logo = icone ? `data:image/png;base64,${icone.toString("base64")}` : null;
  const motif = Array.from({ length: 30 }, (_, k) => ["#009e60", "#f5c400", "#f77f00", "#1c1917", "#009e60", "#f77f00"][k % 6]);
  const membres: [string, string, string][] = [["AK", "#fde7d0", "#c2410c"], ["MB", "#dbeafe", "#1d4ed8"], ["YJ", "#ede9fe", "#6d28d9"], ["FT", "#ffe4e6", "#be123c"]];

  const png = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #0b3d2c 0%, #0f5a3f 55%, #148a5c 100%)", fontFamily: "Jakarta", fontWeight: 500, color: "white", position: "relative" }}>
        {/* cercles décoratifs */}
        <div style={{ position: "absolute", right: -120, top: -140, width: 520, height: 520, borderRadius: 999, background: "rgba(255,255,255,0.06)", display: "flex" }} />
        <div style={{ position: "absolute", left: 380, bottom: -200, width: 420, height: 420, borderRadius: 999, background: "rgba(245,196,0,0.08)", display: "flex" }} />

        {/* Texte */}
        <div style={{ display: "flex", flexDirection: "column", padding: "64px 0 0 72px", width: 660 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {logo && <img src={logo} alt="" width={84} height={84} style={{ borderRadius: 22 }} />}
            <span style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>Sikaklo</span>
          </div>
          <span style={{ marginTop: 34, fontSize: 52, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }}>Tontines, associations et collectes,</span>
          <span style={{ display: "flex", marginTop: 6, fontSize: 52, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }}>
            <span style={{ background: "#f5c400", color: "#0b3d2c", padding: "0 14px", borderRadius: 12 }}>sans palabres.</span>
          </span>
          <span style={{ marginTop: 26, fontSize: 26, color: "#d3eee2", lineHeight: 1.35 }}>Tout le monde voit qui a payé. Les rappels partent sur WhatsApp.</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 34 }}>
            {ops.map((src, k) => <img key={k} src={src} alt="" width={54} height={54} style={{ borderRadius: 14, background: "white" }} />)}
            <span style={{ marginLeft: 8, fontSize: 22, color: "#d3eee2" }}>Wave · Orange · MTN · Moov</span>
          </div>
        </div>

        {/* Carte « caisse du groupe » */}
        <div style={{ position: "absolute", right: 70, top: 92, width: 400, display: "flex", flexDirection: "column", background: "white", borderRadius: 32, padding: 30, color: "#1c1917", boxShadow: "0 30px 60px rgba(0,0,0,0.35)" }}>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2, color: "#f77f00" }}>TONTINE · TOUR 3</span>
          <span style={{ marginTop: 6, fontSize: 28, fontWeight: 800, color: "#0b3d2c" }}>Caisse du tour</span>
          <span style={{ marginTop: 14, fontSize: 52, fontWeight: 800, color: "#0b3d2c", letterSpacing: -1.5 }}>400 000 F</span>
          <span style={{ fontSize: 20, color: "#78716c" }}>sur 500 000 F · 8 ont payé</span>
          <div style={{ display: "flex", marginTop: 18, height: 16, borderRadius: 999, background: "#e7e5e4" }}>
            <div style={{ width: "80%", height: 16, borderRadius: 999, background: "linear-gradient(90deg, #009e60, #f5c400)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 22 }}>
            {membres.map(([t, bg, fg], k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 54, height: 54, borderRadius: 999, background: bg, color: fg, fontSize: 20, fontWeight: 800, border: "4px solid white", marginLeft: k ? -12 : 0 }}>{t}</div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 14, padding: "6px 14px", borderRadius: 999, background: "#dcfce7", color: "#047857", fontSize: 20, fontWeight: 800 }}><div style={{ width: 12, height: 12, borderRadius: 999, background: "#009e60", display: "flex" }} />Payé</div>
          </div>
        </div>

        {/* Bande de motifs */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 16, display: "flex" }}>
          {motif.map((c, k) => <div key={k} style={{ flex: 1, background: c }} />)}
        </div>
      </div>
    ),
    { ...size, fonts: gras && moyen ? [{ name: "Jakarta", data: gras, weight: 800, style: "normal" }, { name: "Jakarta", data: moyen, weight: 500, style: "normal" }] : undefined },
  );
  const brut = Buffer.from(await png.arrayBuffer());
  try {
    const jpeg = await sharp(brut).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg" } });
  } catch {
    return new Response(new Uint8Array(brut), { headers: { "Content-Type": "image/png" } });
  }
}
