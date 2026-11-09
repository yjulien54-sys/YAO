"use client";

import Link from "next/link";

/** Bouton rond d'action rapide (style application bancaire) */
export function ActionRapide({ label, children, onClick, href, interne, disabled, badge }: { label: string; children: React.ReactNode; onClick?: () => void; href?: string; interne?: boolean; disabled?: boolean; badge?: number }) {
  const rond = (
    <span className="relative grid h-14 w-14 place-items-center rounded-full bg-white text-emerald-700 shadow-sm ring-1 ring-stone-200">
      {children}
      {badge !== undefined && (
        <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1 text-[0.75rem] font-bold text-white">{badge}</span>
      )}
    </span>
  );
  const cls = `flex flex-col items-center gap-1.5 whitespace-nowrap text-center text-[0.8125rem] font-semibold text-stone-700 ${disabled ? "pointer-events-none opacity-40" : ""}`;
  if (href && interne) return <Link href={href} className={cls}>{rond}{label}</Link>;
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{rond}{label}</a>;
  return <button onClick={onClick} disabled={disabled} className={cls}>{rond}{label}</button>;
}
