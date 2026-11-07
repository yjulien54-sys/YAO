# Publier Cotiz sur le Google Play Store — étapes

## Étape 1 — Compte Google Play Console (toi)
1. Va sur https://play.google.com/console et connecte-toi avec ton compte Google.
2. Choisis un compte « Personnel » (ou « Organisation » si tu as une entreprise).
3. Paie les frais d'inscription (paiement unique par carte bancaire) et fais la vérification d'identité.
   → Vérifie le prix et les conditions affichés : ils peuvent changer.

## Étape 2 — Fabriquer l'application Android avec PWABuilder (toi, guidé)
1. Va sur https://www.pwabuilder.com
2. Colle l'adresse : https://tontine-et-cotise.vercel.app  puis « Start ».
3. Clique sur « Package for stores » → « Android » → « Generate Package ».
4. Réglages conseillés :
   - Package ID : ci.cotiz.app (ou celui proposé)
   - App name : Cotiz – Tontines & cotisations
   - Short name : Cotiz
   - Couleur : #009e60
   - Signing key : « Create new » (PWABuilder crée la clé)
5. Télécharge le fichier .zip. ⚠️ GARDE-LE PRÉCIEUSEMENT : il contient la clé de signature
   (sans elle, impossible de mettre à jour l'app plus tard). Fais-en une copie sur une clé USB / Google Drive.
6. Dans le zip, ouvre le fichier « assetlinks.json » et envoie-moi son contenu :
   il ne contient rien de secret (seulement le nom de l'app et une empreinte publique).
   Je le brancherai sur le site pour que l'app s'affiche en plein écran, sans barre d'adresse.

## Étape 3 — Créer l'app dans la Play Console (toi, guidé)
1. « Créer une application » → nom : Cotiz – Tontines & cotisations → langue : Français → Application → Gratuite.
2. Remplis la fiche avec les textes de FICHE-PLAY-STORE.md et les images du dossier store/.
3. Réponds aux questionnaires (réponses suggérées dans FICHE-PLAY-STORE.md).
4. Onglet « Tests fermés » : crée une version et envoie le fichier .aab du zip PWABuilder.
5. Ajoute au moins 12 testeurs (adresses Gmail de proches) : pour les nouveaux comptes personnels,
   Google demande en général 14 jours de test fermé avant la publication pour tout le monde.
6. Après la période de test : « Demander l'accès à la production » → publication.

## iPhone
- Aujourd'hui : Safari → Partager → « Sur l'écran d'accueil » (gratuit, avec le logo).
- App Store plus tard : compte Apple Developer (abonnement annuel) + Mac, et risque de refus
  pour les applications qui ne sont qu'un site web.
