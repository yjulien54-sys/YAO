import type { Metadata } from "next";
import { Contenu } from "./Contenu";

export const metadata: Metadata = {
  title: "Télécharger Sikaklo (Android et iPhone)",
  description: "Installez l'application Sikaklo sur votre téléphone Android ou votre iPhone.",
};

export default function Telecharger() {
  return <Contenu />;
}
