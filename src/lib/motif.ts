/**
 * Le « motif » d'une cagnotte en une phrase courte, pour l'aperçu du lien et le message WhatsApp.
 * On saute les salutations (« Chers fils et filles… ») et on préfère la phrase qui dit à quoi sert l'argent.
 */
export function phraseMotif(texte: string | null | undefined, max = 110): string | null {
  if (!texte) return null;
  const phrases = texte
    .split(/\n+|(?<=[.!?])\s+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 25 && !/,$/.test(p) && !/^(chers?|chères?|bonjour|bonsoir|salut|merci)\b/i.test(p));
  if (!phrases.length) return null;
  const utile = phrases.find((p) => /(cagnotte|collecte|argent|fonds).{0,40}(sert|servira|pour|afin|destin|financ)|\b(pour aider|afin de|soutenir|financer)\b/i.test(p)) ?? phrases[0];
  return utile.length > max ? utile.slice(0, max - 2).replace(/\s+\S*$/, "") + "…" : utile;
}

/** Le même message WhatsApp partout (page publique, bannière, réglages, bouton Partager) */
export function messageCagnotte(o: { nom: string; cause?: string | null; message?: string | null; lien: string; collecte?: string | null }): string {
  const lignes = [`*${o.nom}*`];
  if (o.cause?.trim()) lignes.push(`*Motif : ${o.cause.trim()}*`);
  const phrase = phraseMotif(o.message, 140);
  if (phrase) lignes.push(phrase);
  lignes.push("");
  lignes.push(o.collecte ? `${o.collecte}. Chaque geste compte 🙏` : "Chaque geste compte 🙏");
  lignes.push("", "Participez ici :", o.lien);
  return lignes.join("\n");
}
