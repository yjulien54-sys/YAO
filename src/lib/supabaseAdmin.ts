import { createClient } from "@supabase/supabase-js";

/**
 * Connexion séparée pour l'espace Administration.
 * Elle a son propre stockage : se connecter en administrateur ne déconnecte pas
 * le compte utilisateur Cotiz ouvert sur le même téléphone.
 */
export const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "cotiz-admin-auth", detectSessionInUrl: false },
});
