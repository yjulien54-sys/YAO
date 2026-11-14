/* eslint-disable @next/next/no-img-element */
/** Vrais logos des moyens de paiement en Côte d'Ivoire (Wave, Orange Money, MTN MoMo, Moov Money) */
export type IdOperateur = "wave" | "orange" | "mtn" | "moov";
const NOMS: Record<IdOperateur, string> = { wave: "Wave", orange: "Orange Money", mtn: "MTN MoMo", moov: "Moov Money" };

export function LogoOperateur({ id, taille = 36, className = "" }: { id: IdOperateur; taille?: number; className?: string }) {
  return (
    <img src={`/operateurs/${id}.png`} alt={NOMS[id]} width={taille} height={taille} loading="lazy"
      className={`shrink-0 rounded-[22%] bg-white object-cover ring-1 ring-black/5 ${className}`} style={{ width: taille, height: taille }} />
  );
}

/** Rangée des 4 logos (ex : « Payez avec … ») */
export function LogosOperateurs({ taille = 28, className = "" }: { taille?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {(["wave", "orange", "mtn", "moov"] as IdOperateur[]).map((id) => <LogoOperateur key={id} id={id} taille={taille} />)}
    </span>
  );
}
