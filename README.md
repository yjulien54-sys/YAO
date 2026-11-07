# Cotiz 🇨🇮

**Tontines, associations et collectes, sans palabres.**

Cotiz aide les Ivoiriens à gérer leurs cotisations : tontines, associations de ressortissants, mutuelles, collectes pour des funérailles, mariages, baptêmes… Tout le monde voit qui a payé, les paiements se font par Mobile Money et les relances partent sur WhatsApp.

## Lancer le prototype

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000 (de préférence en vue mobile).
Connexion : n'importe quel nom, un numéro à 10 chiffres et le code **1234**. Trois groupes de démo sont créés automatiquement.

## Ce qui marche déjà

- Connexion par numéro de téléphone (code SMS simulé)
- Création de groupes : tontine, association, collecte
- Tableau transparent : payé, en attente, en retard
- Calcul automatique des pénalités de retard
- Ordre de passage de la tontine, avec tirage au sort
- Paiement Wave, Orange Money, MTN MoMo, Moov Money (**simulé**)
- Paiement en espèces enregistré par le trésorier
- Relances WhatsApp individuelles ou groupées (vrais liens `wa.me`, message pré-rempli)
- Invitation et partage de reçu sur WhatsApp
- Clôture d'un tour et passage au suivant
- Application installable sur le téléphone (PWA)

## Ce qui reste simulé

| Prototype | Production |
|---|---|
| Données dans le navigateur (`localStorage`) | Supabase (`supabase/schema.sql`) |
| Code SMS fixe `1234` | Supabase Auth avec OTP par SMS |
| Paiement simulé (`src/lib/payments.ts`) | CinetPay ou PayDunya, avec confirmation par webhook |
| Relance manuelle (lien WhatsApp) | Relances automatiques via l'API WhatsApp Business |

⚠️ **Réglementation BCEAO** : Cotiz ne doit jamais garder l'argent. Les paiements vont sur le compte marchand du groupe, chez un agrégateur agréé.

## Structure

```
src/
  app/
    page.tsx                      Accueil et connexion
    groupes/page.tsx              Liste de mes groupes
    groupes/nouveau/page.tsx      Création d'un groupe
    groupes/[id]/page.tsx         Détail : membres, historique, tours, trésorier
    groupes/[id]/payer/page.tsx   Paiement Mobile Money
    groupes/[id]/recu/[pid]/      Reçu
  lib/
    types.ts      Modèle de données
    logic.ts      Règles métier (échéances, retards, pénalités, bénéficiaire)
    store.tsx     État de l'app (à remplacer par Supabase)
    whatsapp.ts   Messages de relance et de partage
    payments.ts   Opérateurs et paiement (simulé)
    demo.ts       Données de démo
supabase/schema.sql  Schéma de base de données et règles de sécurité
```
