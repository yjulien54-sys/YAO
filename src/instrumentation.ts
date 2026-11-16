/**
 * Vérification des variables d'environnement au démarrage du serveur.
 * On n'affiche JAMAIS la valeur d'une clé : seulement son nom, dans les journaux Vercel.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const obligatoires = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const manquantes = obligatoires.filter((n) => !process.env[n]?.trim());
  if (manquantes.length) console.error(`[sécurité] Variables manquantes dans Vercel : ${manquantes.join(", ")}`);

  // Une clé secrète ne doit jamais être dans une variable NEXT_PUBLIC_ (elle serait visible par tout le monde)
  for (const [nom, valeur] of Object.entries(process.env)) {
    if (!nom.startsWith("NEXT_PUBLIC_") || !valeur) continue;
    if (/sk-ant-|priv_|GPAY-|sk_live|sk_test|service_role/i.test(valeur) || jwtServiceRole(valeur)) {
      console.error(`[sécurité] DANGER : la variable ${nom} contient une clé secrète. Retirez-la de Vercel et changez cette clé.`);
    }
  }
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith("https://")) {
    console.error("[sécurité] NEXT_PUBLIC_SUPABASE_URL doit commencer par https://");
  }
}

function jwtServiceRole(v: string): boolean {
  const p = v.split(".");
  if (p.length !== 3) return false;
  try {
    return JSON.parse(Buffer.from(p[1], "base64url").toString("utf8"))?.role === "service_role";
  } catch {
    return false;
  }
}
