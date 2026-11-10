"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();

  // Glisser vers la gauche = onglet suivant, vers la droite = onglet précédent
  useEffect(() => {
    ONGLETS.forEach((o) => router.prefetch(o.href));
    let depart: { x: number; y: number; t: number } | null = null;
    const debut = (e: TouchEvent) => {
      const cible = e.target as HTMLElement;
      if (e.touches.length !== 1 || cible.closest("[data-pas-glisser], input, textarea, select, .fixed")) return (depart = null);
      depart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    };
    const fin = (e: TouchEvent) => {
      if (!depart) return;
      const dx = e.changedTouches[0].clientX - depart.x, dy = e.changedTouches[0].clientY - depart.y;
      const rapide = Date.now() - depart.t < 700;
      depart = null;
      if (!rapide || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
      const i = ONGLETS.findIndex((o) => o.href === path);
      const j = dx < 0 ? i + 1 : i - 1;
      if (i < 0 || j < 0 || j >= ONGLETS.length) return;
      try { sessionStorage.setItem("cotiz:glisse", dx < 0 ? "gauche" : "droite"); } catch {}
      router.push(ONGLETS[j].href);
    };
    window.addEventListener("touchstart", debut, { passive: true });
    window.addEventListener("touchend", fin, { passive: true });
    return () => {
      window.removeEventListener("touchstart", debut);
      window.removeEventListener("touchend", fin);
    };
  }, [path, router]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t lg:hidden border-stone-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
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
