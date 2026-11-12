# Cotiz 🇨🇮

**Tontines, associations et collectes, sans palabres.**

Cotiz aide à gérer les cotisations en toute transparence : tout le monde voit qui a payé, personne ne se marque « payé » seul, et l'argent ne sort qu'après validation de plusieurs responsables.

- Application : https://tontine-et-cotise.vercel.app
- Administration (fondateur et agents) : https://tontine-et-cotise.vercel.app/admin

## Technique

- **Next.js 15** (App Router, TypeScript, Tailwind) — dossier `src/`
- **Supabase** (base de données, comptes, sécurité RLS) — mises à jour SQL dans `supabase/`
- **Vercel** — mise en ligne automatique à chaque envoi sur la branche `main`
- Application Android (Capacitor) — dossiers `android/` et `store/`

## Mises à jour SQL

À lancer dans l'ordre dans Supabase (SQL Editor) : `schema.sql`, puis `migration-2` … `migration-23`.
`remise-a-zero.sql` efface toutes les données des clients (garde l'équipe) : à utiliser avec prudence.

## Variables d'environnement (Vercel)

Les **valeurs** ne doivent jamais être écrites dans le code ni envoyées dans une conversation.

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Connexion à Supabase (publiques) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé serveur secrète (connexion sur un nouveau téléphone, admin, paiements) |
| `NEXT_PUBLIC_PAIEMENT_MODE` | `manuel` (défaut), `wave`, `geniuspay`, `mixte`, `cinetpay`, `simulation` |
| `WAVE_API_KEY` | API Wave Business (mode `wave` ou `mixte`) |
| `GENIUSPAY_API_KEY` (clé « GPAY-… »), `GENIUSPAY_SECRET_KEY` (facultative), `GENIUSPAY_WEBHOOK_SECRET` | GeniusPay (mode `geniuspay` ou `mixte`) |

## Développement

```bash
npm install
npm run dev
```
