// Version de l’image : uniquement le logo Sikaklo
/**
 * Image qui apparaît quand on partage le lien de l'application Sikaklo : juste le logo.
 * Fabriquée une seule fois, au déploiement.
 */
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Sikaklo";
export const size = { width: 1200, height: 630 };
// JPEG léger : WhatsApp n'affiche pas les images trop lourdes
export const contentType = "image/jpeg";

export default async function Image() {
  const icone = await readFile(join(process.cwd(), "public/icons/icon-512.png")).catch(() => null);
  const logo = icone ? `data:image/png;base64,${icone.toString("base64")}` : null;

  const png = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo && <img src={logo} alt="" width={460} height={460} />}
      </div>
    ),
    { ...size },
  );
  const brut = Buffer.from(await png.arrayBuffer());
  try {
    const jpeg = await sharp(brut).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg" } });
  } catch {
    return new Response(new Uint8Array(brut), { headers: { "Content-Type": "image/png" } });
  }
}
