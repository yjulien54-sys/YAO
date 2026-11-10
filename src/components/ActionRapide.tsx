"use client";

import Link from "next/link";

/** Bouton rond d'action rapide (style application bancaire) */
export function ActionRapide({ label, children, onClick, href, interne, disabled, badge }: { label: string; children: React.ReactNode; onClick?: () => void; href?: string; interne?: boolean; disabled?: boolean; badge?: number }) {
  const rond = (
    <span className="relative grid h-[52px] w-[52px] place-items-center rounded-[16px] bg-white text-emerald-800 ring-1 ring-stone-200/90 transition group-hover:ring-emerald-300 group-active:scale-95">
      {children}
      {badge !== undefined && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 ring-2 ring-[#f7f5f0] place-items-center rounded-full bg-orange-500 px-1 text-[0.75rem] font-bold text-white">{badge}</span>
      )}
    </span>
  );
  const cls = `group flex flex-col items-center gap-1.5 whitespace-nowrap text-center text-[0.8125rem] font-medium text-stone-700 ${disabled ? "pointer-events-none opacity-40" : ""}`;
  if (href && interne) return <Link href={href} className={cls}>{rond}{label}</Link>;
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{rond}{label}</a>;
  return <button onClick={onClick} disabled={disabled} className={cls}>{rond}{label}</button>;
}
