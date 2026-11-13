import { supabase } from "./supabase";

/** Note où en est une inscription (pour que le service client puisse rappeler la personne si elle bloque).
 *  Ne bloque jamais l'inscription : toute erreur est ignorée (sans la mise à jour SQL n°32, rien ne se passe). */
export function noterTentative(tel: string, nom: string, etape: "formulaire" | "code_envoye" | "erreur_envoi" | "code_refuse" | "terminee" | "erreur", erreur?: string) {
  supabase.rpc("noter_tentative", { tel, nom, etape, erreur: erreur ?? null }).then(() => {}, () => {});
}
