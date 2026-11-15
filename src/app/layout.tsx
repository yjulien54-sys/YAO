import type { Metadata, Viewport } from "next";
import { StoreProvider } from "@/lib/store";
import { ServiceWorker } from "@/components/ServiceWorker";
import { Glisser } from "@/components/Glisser";
import { Bienvenue } from "@/components/Bienvenue";
import { NotificationsProvider } from "@/lib/notifications";
import { CompteBloque } from "@/components/CompteBloque";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tontine-et-cotise.vercel.app"),
  title: "Cotiz — Tontines & cotisations simplifiées",
  openGraph: {
    title: "Cotiz — Tontines, associations et collectes, sans palabres",
    description: "Tout le monde voit qui a payé. Paiement Wave, Orange Money, MTN, Moov. Rappels WhatsApp automatiques.",
    siteName: "Cotiz", locale: "fr_FR", type: "website",
  },
  description:
    "Gérez vos tontines, associations et collectes en toute transparence. Paiement Wave, Orange Money, MTN, Moov et relances WhatsApp automatiques.",
  icons: { icon: "/icons/logo.svg", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Cotiz", statusBarStyle: "default" },
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
        <StoreProvider>
          <NotificationsProvider>
            {children}
            <Bienvenue />
            <CompteBloque />
          </NotificationsProvider>
        </StoreProvider>
        <ServiceWorker />
        <Glisser />
      </body>
    </html>
  );
}
