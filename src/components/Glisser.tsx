"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Les 4 onglets du bas, dans l'ordre du glissement */
export const ONGLETS_ORDRE = ["/groupes", "/activite", "/aide", "/profil"];

/** Page « parente » d'une page intérieure (même destination que la flèche retour) */
function parent(path: string): string | null {
  const m = path.match(/^\/groupes\/([0-9a-f-]{36})(\/.*)?$/i);
  if (m) return m[2] ? `/groupes/${m[1]}` : "/groupes";
  if (path === "/groupes/nouveau") return "/groupes";
  return null;
}

/**
 * Glisser du doigt partout dans l'application :
 * - onglets du bas : gauche = onglet suivant, droite = onglet précédent ;
 * - pages intérieures (groupe, paiement, réglages…) : droite = retour, gauche = page qu'on vient de quitter.
 */
export function Glisser() {
  const path = usePathname();
  const router = useRouter();
  const suivantes = useRef<string[]>([]); // pages quittées par un retour, pour y revenir en glissant à gauche
  const parGlissement = useRef(false);

  // Si on change de page autrement qu'en glissant (un lien, un bouton), on oublie les pages « suivantes »
  useEffect(() => {
    if (parGlissement.current) parGlissement.current = false;
    else suivantes.current = [];
  }, [path]);

  useEffect(() => {
    let depart: { x: number; y: number; t: number } | null = null;

    const debut = (e: TouchEvent) => {
      const cible = e.target as HTMLElement;
      if (e.touches.length !== 1 || cible.closest("[data-pas-glisser], input, textarea, select, .fixed:not(nav)")) return (depart = null);
      depart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    };

    const aller = (href: string, sens: "gauche" | "droite") => {
      try { sessionStorage.setItem("cotiz:glisse", sens); } catch {}
      parGlissement.current = true;
      router.push(href);
    };

    const fin = (e: TouchEvent) => {
      if (!depart) return;
      const dx = e.changedTouches[0].clientX - depart.x, dy = e.changedTouches[0].clientY - depart.y;
      const rapide = Date.now() - depart.t < 700;
      depart = null;
      if (!rapide || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;

      // Onglets du bas
      const i = ONGLETS_ORDRE.indexOf(path);
      if (i >= 0) {
        if (dx < 0 && suivantes.current.length && i === 0) {
          // Depuis l'accueil, on peut revenir dans le groupe qu'on vient de quitter
          return aller(suivantes.current.pop()!, "gauche");
        }
        const j = dx < 0 ? i + 1 : i - 1;
        if (j >= 0 && j < ONGLETS_ORDRE.length) aller(ONGLETS_ORDRE[j], dx < 0 ? "gauche" : "droite");
        return;
      }

      // Pages intérieures
      if (dx > 0) {
        const p = parent(path);
        if (!p) return;
        suivantes.current.push(path);
        aller(p, "droite");
      } else if (suivantes.current.length) {
        aller(suivantes.current.pop()!, "gauche");
      }
    };

    window.addEventListener("touchstart", debut, { passive: true });
    window.addEventListener("touchend", fin, { passive: true });
    return () => {
      window.removeEventListener("touchstart", debut);
      window.removeEventListener("touchend", fin);
    };
  }, [path, router]);

  return null;
}
