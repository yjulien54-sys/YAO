"use client";

import Link from "next/link";

/** Couleurs des boutons d'action rapide : fond teinté + icône de la même couleur */
const TONS = {
  blanc: "bg-white text-emerald-800 ring-1 ring-stone-200/90",
  vert: "bg-emerald-600 text-white shadow-md shadow-emerald-700/25",
  bleu: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
  ambre: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  violet: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",
} as const;

/** Bouton d'action rapide (style application bancaire) */
export function ActionRapide({ label, children, onClick, href, interne, disabled, badge, ton = "blanc" }: { label: string; children: React.ReactNode; onClick?: () => void; href?: string; interne?: boolean; disabled?: boolean; badge?: number; ton?: keyof typeof TONS }) {
  const rond = (
    <span className={`relative grid h-[56px] w-[56px] place-items-center rounded-[18px] transition group-hover:brightness-95 group-active:scale-95 ${TONS[ton]}`}>
      {children}
      {badge !== undefined && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 ring-2 ring-[#f7f5f0] place-items-center rounded-full bg-orange-500 px-1 text-[0.75rem] font-bold text-white">{badge}</span>
      )}
    </span>
  );
  const cls = `group flex flex-col items-center gap-1.5 whitespace-nowrap text-center text-[0.875rem] font-bold text-stone-900 ${disabled ? "pointer-events-none opacity-40" : ""}`;
  if (href && interne) return <Link href={href} className={cls}>{rond}{label}</Link>;
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{rond}{label}</a>;
  return <button onClick={onClick} disabled={disabled} className={cls}>{rond}{label}</button>;
}
