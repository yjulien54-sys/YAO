"use client";

/**
 * Appui long (téléphone) ou clic droit (ordinateur) → ouvre un menu d'actions.
 * Après un appui long, le simple « clic » qui suit est ignoré (on n'ouvre pas le lien).
 */
import { useRef } from "react";
import { vibrer } from "./haptique";

export function useAppuiLong(delai = 480) {
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const long = useRef(false);

  const annuler = () => { if (minuteur.current) clearTimeout(minuteur.current); minuteur.current = null; };

  /** Les gestionnaires à poser sur l'élément ; action = ce qu'on fait après l'appui long */
  const sur = (action: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      long.current = false;
      depart.current = { x: e.clientX, y: e.clientY };
      annuler();
      minuteur.current = setTimeout(() => { long.current = true; vibrer("touche"); action(); }, delai);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (depart.current && Math.hypot(e.clientX - depart.current.x, e.clientY - depart.current.y) > 10) annuler();
    },
    onPointerUp: annuler,
    onPointerLeave: annuler,
    onPointerCancel: annuler,
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); annuler(); long.current = true; action(); },
    onClickCapture: (e: React.MouseEvent) => { if (long.current) { e.preventDefault(); e.stopPropagation(); long.current = false; } },
    style: { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } as React.CSSProperties,
  });
  return sur;
}

/** Copier un texte (avec repli pour les vieux téléphones) */
export async function copier(texte: string) {
  try { await navigator.clipboard.writeText(texte); return true; } catch {
    try {
      const t = document.createElement("textarea");
      t.value = texte; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
      return true;
    } catch { return false; }
  }
}
