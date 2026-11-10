import type { Metadata, Viewport } from "next";
import { StoreProvider } from "@/lib/store";
import { ServiceWorker } from "@/components/ServiceWorker";
import { Glisser } from "@/components/Glisser";
import { Bienvenue } from "@/components/Bienvenue";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cotiz — Tontines & cotisations simplifiées",
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
          {children}
          <Bienvenue />
        </StoreProvider>
        <ServiceWorker />
        <Glisser />
      </body>
    </html>
  );
}
