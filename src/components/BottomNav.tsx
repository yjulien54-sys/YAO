"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CircleUser, Headset, House } from "lucide-react";

const ONGLETS = [
  { href: "/groupes", label: "Accueil", icon: House },
  { href: "/activite", label: "Activité", icon: Activity },
  { href: "/aide", label: "Aide", icon: Headset },
  { href: "/profil", label: "Profil", icon: CircleUser },
];

/** Barre de navigation en bas de l'écran (style application) */
export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-stone-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="grid grid-cols-4">
        {ONGLETS.map(({ href, label, icon: Icon }) => {
          const actif = path === href;
          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2.5 text-[0.75rem] font-semibold transition ${actif ? "text-emerald-700" : "text-stone-500"}`}>
              <span className={`grid h-8 w-14 place-items-center rounded-full transition ${actif ? "bg-emerald-50" : ""}`}>
                <Icon size={21} strokeWidth={actif ? 2.1 : 1.75} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
