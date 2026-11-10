"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Lightbulb, Megaphone, Smartphone, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Annonce = { id: string; titre: string; texte?: string | null; lien?: string | null; bouton?: string | null; couleur: "vert" | "orange" | "bleu" | "sombre" };

// Annonces par défaut (si la table n'existe pas encore ou est vide)
const DEFAUT: Annonce[] = [
  { id: "d1", titre: "Bienvenue sur Cotiz", texte: "Tontines, associations et collectes : tout le monde voit qui a payé.", couleur: "vert" },
  { id: "d2", titre: "Cotiz sur ton téléphone", texte: "Installe l’application Android en quelques secondes.", lien: "/telecharger", bouton: "Télécharger", couleur: "sombre" },
];

const FOND = {
  vert: "degrade-vert text-white",
  orange: "degrade-or text-white",
  bleu: "bg-gradient-to-br from-sky-500 to-blue-700 text-white",
  sombre: "bg-gradient-to-br from-stone-800 to-stone-950 text-white",
};

const DUREE = 5000; // temps de lecture de chaque annonce (ms)

const ETIQUETTE: Record<string, string> = { vert: "Cotiz", orange: "Nouveauté", bleu: "Information", sombre: "Application" };

/** Bandeau d'annonces qui défile (publicités, nouveautés, mises à jour) */
export function Annonces() {
  const [liste, setListe] = useState<Annonce[]>(DEFAUT);

  useEffect(() => {
    try {
      const c = sessionStorage.getItem("cotiz:annonces");
      if (c) setListe(JSON.parse(c));
    } catch {}
    supabase
      .from("annonces")
      .select("id, titre, texte, lien, bouton, couleur")
      .order("ordre")
      .limit(8)
      .then(({ data, error }) => {
        if (!error && data && data.length) {
          setListe(data as Annonce[]);
          try {
            sessionStorage.setItem("cotiz:annonces", JSON.stringify(data));
          } catch {}
        }
      });
  }, []);

  // Défilement : chaque annonce glisse de la droite vers la gauche, reste quelques secondes, puis la suivante arrive.
  // On ajoute une copie de la première annonce à la fin pour boucler sans retour en arrière visible.
  const n = liste.length;
  const [pos, setPos] = useState(0);
  const [anime, setAnime] = useState(true);
  const [pause, setPause] = useState(false);
  const toucheX = useRef<number | null>(null);

  useEffect(() => {
    if (n < 2 || pause) return;
    const t = setTimeout(() => {
      setAnime(true);
      setPos((x) => x + 1);
    }, DUREE);
    return () => clearTimeout(t);
  }, [n, pos, pause]);

  useEffect(() => {
    if (anime) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setAnime(true)));
    return () => cancelAnimationFrame(r);
  }, [anime]);

  function finTransition() {
    if (pos >= n) {
      setAnime(false);
      setPos(0);
    }
  }
  function aller(cible: number) {
    if (cible < 0) {
      // Revenir en arrière depuis la première : on saute sur la copie, puis on glisse vers la dernière
      setAnime(false);
      setPos(n);
      requestAnimationFrame(() => requestAnimationFrame(() => { setAnime(true); setPos(n - 1); }));
      return;
    }
    setAnime(true);
    setPos(cible);
  }

  if (!n) return null;
  const actif = pos % n;
  const diapos = n > 1 ? [...liste, liste[0]] : liste;

  return (
    <section aria-label="Annonces" aria-roledescription="carrousel">
      <div
        className="overflow-hidden rounded-[22px] shadow-[0_10px_30px_-12px_rgba(6,78,59,0.35)] ring-1 ring-black/5"
        onMouseEnter={() => setPause(true)}
        onMouseLeave={() => setPause(false)}
        onTouchStart={(e) => { toucheX.current = e.touches[0].clientX; setPause(true); }}
        onTouchEnd={(e) => {
          const d = toucheX.current === null ? 0 : e.changedTouches[0].clientX - toucheX.current;
          toucheX.current = null;
          setPause(false);
          if (n > 1 && Math.abs(d) > 40) aller(d < 0 ? pos + 1 : pos - 1);
        }}
      >
        <div
          className="flex"
          style={{ transform: `translateX(-${pos * 100}%)`, transition: anime ? "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)" : "none" }}
          onTransitionEnd={finTransition}
        >
          {diapos.map((a, j) => (
            <Diapo key={`${a.id}-${j}`} a={a} cachee={j % n !== actif || (j === n && pos !== n)} />
          ))}
        </div>
      </div>
      {n > 1 && (
        <div className="mt-2.5 flex justify-center gap-1.5">
          {liste.map((x, j) => (
            <button
              key={x.id}
              aria-label={`Annonce ${j + 1} sur ${n}`}
              aria-current={j === actif}
              onClick={() => aller(j)}
              className={`relative h-1.5 overflow-hidden rounded-full transition-all duration-300 ${j === actif ? "w-7 bg-stone-300" : "w-1.5 bg-stone-300 hover:bg-stone-400"}`}
            >
              {j === actif && (
                <span
                  key={`${pos}-${pause}`}
                  className="absolute inset-y-0 left-0 rounded-full bg-emerald-600"
                  style={{ animation: pause ? "none" : `remplir ${DUREE}ms linear forwards`, width: pause ? "100%" : undefined }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function iconeDe(a: Annonce) {
  if (a.lien?.includes("telecharger")) return Smartphone;
  if (a.lien?.includes("aide")) return Lightbulb;
  if (a.couleur === "orange") return Sparkles;
  return Megaphone;
}

function Diapo({ a, cachee }: { a: Annonce; cachee: boolean }) {
  const Icone = iconeDe(a);
  const externe = a.lien?.startsWith("http");
  const corps = (
    <div className={`relative flex h-full min-h-[128px] w-full items-center gap-4 overflow-hidden px-5 py-4 ${FOND[a.couleur] ?? FOND.vert}`}>
      <div className="motif pointer-events-none absolute inset-0 opacity-30" />
      {/* Cercles décoratifs */}
      <span className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute -bottom-16 right-10 h-32 w-32 rounded-full bg-white/5" />
      <div className="relative min-w-0 flex-1">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white/70">{ETIQUETTE[a.couleur] ?? "Annonce"}</p>
        <p className="mt-0.5 line-clamp-2 text-[1.02rem] font-extrabold leading-snug">{a.titre}</p>
        {a.texte && <p className="mt-1 line-clamp-2 text-[0.8rem] leading-snug text-white/85">{a.texte}</p>}
        {a.lien && a.bouton && (
          <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-stone-900 shadow-sm">
            {a.bouton} <ChevronRight size={14} strokeWidth={2.4} />
          </span>
        )}
      </div>
      <span className="relative grid h-16 w-16 shrink-0 place-items-center rounded-[20px] bg-white/15 ring-1 ring-white/30 backdrop-blur-sm">
        <Icone size={28} strokeWidth={1.7} />
      </span>
    </div>
  );
  const props = { className: "block w-full shrink-0", "aria-hidden": cachee, tabIndex: cachee ? -1 : undefined };
  if (!a.lien) return <div {...props}>{corps}</div>;
  return externe ? (
    <a href={a.lien} target="_blank" rel="noreferrer" {...props}>{corps}</a>
  ) : (
    <Link href={a.lien} {...props}>{corps}</Link>
  );
}
