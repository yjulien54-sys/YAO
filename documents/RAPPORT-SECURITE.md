# Rapport de sécurité — Sikaklo

Date : 16 novembre 2026 · Site : https://www.sikaklo.com

## Résumé

| | |
|---|---|
| Failles graves trouvées | **1** (montant payé non vérifié) → corrigée |
| Failles moyennes | **5** → corrigées |
| Points déjà solides | 12 |
| Actions qui restent à faire par vous | 5 |

---

## 1. Failles trouvées et corrigées

| # | Gravité | Problème | Correction |
|---|---|---|---|
| 1 | 🔴 Grave | Quand l'opérateur confirmait un paiement, le **montant payé n'était pas comparé** au montant demandé. | Le serveur compare maintenant la somme reçue (et la devise XOF) avec ce qui était demandé. Si elle est trop faible, le paiement **n'est pas validé** et une alerte « Montant payé incorrect » est créée. |
| 2 | 🟠 Moyen | **Aucune limite de requêtes** : un robot pouvait envoyer des milliers de demandes (connexion, paiements, IA). | Limite par adresse IP ou par compte sur toutes les routes sensibles (ex. connexion : 10 essais / 10 min ; paiement : 10 / 10 min ; IA : 30 / 10 min). |
| 3 | 🟠 Moyen | N'importe qui pouvait tester des milliers de numéros pour savoir **qui a un compte** (fonction ouverte à tous). | La vérification passe par le serveur, avec une limite (15 / 10 min). La fonction n'est plus appelable depuis un navigateur. |
| 4 | 🟠 Moyen | **Pas d'en-têtes de sécurité** (protection contre l'affichage du site dans un autre site, contre l'injection de scripts…). | CSP, HSTS (HTTPS obligatoire), X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy ajoutés. Testé : 0 blocage sur le site. |
| 5 | 🟠 Moyen | **Fichiers envoyés** : aucun contrôle côté serveur du type ni de la taille. | Photos de cagnotte : JPG/PNG/WEBP, 5 Mo maximum. Dossiers des agents : images ou PDF, 10 Mo. Contrôle aussi dans l'admin. |
| 6 | 🟠 Moyen | Dépendance **PostCSS** avec failles connues (via Next.js). | Mise à jour forcée vers la version corrigée. `npm audit` en production : **0 faille**. |
| 7 | 🟡 Faible | Certains messages d'erreur montraient des détails techniques de la base. | Messages neutres pour l'utilisateur ; le détail reste dans les journaux privés. |
| 8 | 🟡 Faible | Quelques paramètres reçus n'étaient pas vérifiés (identifiants, numéro, moyen de paiement, montant maximum). | Vérification stricte côté serveur (format, longueur, 5 000 000 F maximum par paiement). |
| 9 | 🟡 Faible | Route de création d'affiche ouverte sans limite (coûteuse). | Limite + vérification du lien. |

## 2. Nouvelles protections

- **Journal des activités suspectes** : admin → onglet **Sécurité** (fondateur seulement). Il enregistre :
  - limites dépassées ;
  - codes faux répétés ;
  - faux appels de paiement ;
  - montants incorrects ;
  - accès admin refusés.
- **Vérification des variables d'environnement** au démarrage. Le serveur signale une clé manquante, ou une clé secrète mise par erreur dans une variable publique.
- **API jamais gardée en cache**, et la technologie utilisée n'est plus annoncée (`X-Powered-By` retiré).

## 3. Points vérifiés et déjà solides ✅

| Demande | Résultat |
|---|---|
| Vraie authentification | Supabase Auth. Chaque route serveur vérifie le jeton de connexion. |
| Mots de passe / codes hachés | Codes secrets chiffrés en **bcrypt** (pgcrypto). Mots de passe des agents gérés par Supabase (bcrypt). |
| Blocage après erreurs | Compte bloqué après **5 codes faux en 1 h**. |
| Clés d'API cachées | Aucune clé secrète dans le code ni côté navigateur. Elles sont toutes dans Vercel. |
| Historique Git | Scan complet : **aucun secret fuité** (ni clé API, ni clé de signature, ni fichier .env). |
| Clés compromises | Aucune trouvée, donc **aucune clé à révoquer**. |
| Base de données | **Toutes les tables** ont la sécurité ligne par ligne (RLS). Toutes les fonctions sensibles fixent leur `search_path`. |
| Requêtes paramétrées | Aucune requête SQL construite avec du texte : client Supabase et fonctions avec paramètres. |
| Routes admin verrouillées | Chaque action admin est vérifiée dans la base (`verifier_admin` / `verifier_fondateur`) et inscrite dans le journal. Testé : faux jeton → **refusé (403)**. |
| HTTPS imposé | Vercel redirige vers HTTPS, et HSTS est ajouté. |
| Protection XSS | React échappe tout. Le seul HTML injecté est une donnée fixe pour Google. La CSP est en plus. |
| CSRF | Les routes utilisent un jeton dans l'en-tête `Authorization`, pas de cookie : CSRF impossible. |
| Cookies de session | Aucun cookie de session utilisé (jeton Supabase). |
| Réglages CORS | Aucun accès depuis un autre site autorisé (par défaut, même site seulement). |
| Mode debug | Production compilée, sans fichiers source lisibles. |
| Fichiers exposés | `.env`, `.git`, `package.json` et la clé de signature Android → **404** (testé). |
| Paquets inutilisés | Tous les paquets sont utilisés. |
| Prix et paiements | Montants **calculés par le serveur**, jamais par le téléphone. Confirmation toujours relue chez l'opérateur, et maintenant montant vérifié. |

## 4. Tests réalisés sur le site en ligne

| Attaque simulée | Résultat |
|---|---|
| Paiement sans être connecté / avec un faux jeton | 401 refusé ✅ |
| Bannir un compte avec un faux jeton | 403 refusé ✅ |
| Code secret piégé (`<script>`) | 400 refusé ✅ |
| Redirection piégée (`../../admin`) | renvoyé vers /groupes ✅ |
| Lien d'affiche piégé (`../../etc/passwd`) | 400 refusé ✅ |
| Lecture de `.env`, `.git` | 404 ✅ |
| Base : un visiteur lit le journal ou les limites | 0 ligne visible ✅ |
| Base : un non-fondateur lit les alertes | refusé ✅ |
| Limite de requêtes (4ᵉ essai sur 3 autorisés) | bloqué ✅ (testé sur une base d'essai) |
| Pages du site avec la nouvelle CSP | affichées, 0 blocage ✅ |

## 5. Ce qui reste à faire par vous

1. **Coller la mise à jour SQL n°46** dans Supabase. Sans elle, la limite de requêtes, le journal et le contrôle des fichiers ne sont pas actifs.
2. **Rendre le dépôt GitHub privé.** Aucun secret n'a fuité, mais le code ne doit pas être lisible par tous.
3. **Activer la double authentification (2FA)** sur GitHub, Vercel, Supabase, Google et GeniusPay.
4. **GeniusPay** : si GeniusPay fournit un « secret de webhook », le mettre dans Vercel (`GENIUSPAY_WEBHOOK_SECRET`). Les faux appels seront alors rejetés dès l'arrivée.
5. **Supabase → Authentication → Settings** : réduire la durée de validité des liens de connexion (« Email OTP Expiration ») à **600 secondes**.

Reste connu, sans danger en ligne : une faille « moyenne » dans un outil de vérification du code (ESLint) utilisé seulement pendant le développement. Il n'est pas envoyé sur le site.
