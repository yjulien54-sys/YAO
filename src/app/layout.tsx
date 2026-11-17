import { SITE } from "@/lib/site";
import type { Metadata, Viewport } from "next";
import { StoreProvider } from "@/lib/store";
import { BandeauIPhone } from "@/components/InstallerIPhone";
import { ServiceWorker } from "@/components/ServiceWorker";
import { Glisser } from "@/components/Glisser";
import { Bienvenue } from "@/components/Bienvenue";
import { NotificationsProvider } from "@/lib/notifications";
import { CompteBloque } from "@/components/CompteBloque";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Sikaklo — Application de tontine, association et collecte en Côte d’Ivoire", template: "%s" },
  keywords: ["Sikaklo", "tontine", "tontine en ligne", "application tontine", "cotisation", "association", "collecte", "cagnotte", "Côte d’Ivoire", "Abidjan", "Wave", "Orange Money", "MTN MoMo", "Moov Money", "épargne"],
  applicationName: "Sikaklo",
  // Code de vérification Google Search Console (à mettre dans Vercel : NEXT_PUBLIC_GOOGLE_VERIFICATION)
  verification: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION } : undefined,
  openGraph: {
    title: "Sikaklo — Tontines, associations et collectes, sans palabres",
    description: "Tout le monde voit qui a payé. Paiement Wave, Orange Money, MTN, Moov. Rappels WhatsApp automatiques.",
    siteName: "Sikaklo", locale: "fr_FR", type: "website",
  },
  description:
    "Sikaklo : l’application ivoirienne pour gérer vos tontines, cotisations d’association et collectes (funérailles, mariages…). Tout le monde voit qui a payé. Paiement Wave, Orange Money, MTN, Moov et rappels WhatsApp. Gratuit.",
  icons: { icon: "/icons/logo.svg", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Sikaklo", statusBarStyle: "default" },
};

const DONNEES_GOOGLE = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE}/#cotiz`, name: "Sikaklo", url: SITE, logo: `${SITE}/icons/icon-512.png`, areaServed: "CI", description: "Application de tontine, cotisation et collecte en Côte d’Ivoire." },
    { "@type": "WebSite", "@id": `${SITE}/#site`, name: "Sikaklo", url: SITE, inLanguage: "fr-CI", publisher: { "@id": `${SITE}/#cotiz` } },
    {
      "@type": "SoftwareApplication", name: "Sikaklo", applicationCategory: "FinanceApplication", operatingSystem: "Android, Web",
      url: SITE, inLanguage: "fr", offers: { "@type": "Offer", price: "0", priceCurrency: "XOF" },
      description: "Gérez tontines, associations et collectes : chacun voit qui a payé, paiement Wave, Orange Money, MTN, Moov, rappels WhatsApp.",
      publisher: { "@id": `${SITE}/#cotiz` },
    },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#009e60",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased">
        {/* Fiche d'identité de Sikaklo pour Google (nom, logo, type d'application) */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(DONNEES_GOOGLE) }} />
        <StoreProvider>
          <NotificationsProvider>
            {children}
            <Bienvenue />
            <CompteBloque />
          </NotificationsProvider>
        </StoreProvider>
        <ServiceWorker />
        <BandeauIPhone />
        <Glisser />
      </body>
    </html>
  );
}
