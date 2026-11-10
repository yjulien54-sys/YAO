import type { LucideIcon } from "lucide-react";

export {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Flower2,
  Gift,
  HandCoins,
  HeartHandshake,
  Landmark,
  Lock,
  LogOut,
  MessageCircle,
  PartyPopper,
  Plus,
  Receipt,
  RefreshCw,
  Repeat,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

const TONS = {
  vert: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  orange: "bg-orange-50 text-orange-600 ring-orange-100",
  bleu: "bg-sky-50 text-sky-700 ring-sky-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  rouge: "bg-red-50 text-red-600 ring-red-100",
  ambre: "bg-amber-50 text-amber-700 ring-amber-100",
  gris: "bg-stone-100 text-stone-600 ring-stone-200",
  blanc: "bg-white/15 text-white ring-white/20",
};

const TAILLES = { sm: [32, 16], md: [40, 20], lg: [48, 22], xl: [64, 28] } as const;

/** Icône au trait dans une pastille teintée (style application bancaire) */
export function IconBadge({ icon: Icon, ton = "vert", taille = "md", className = "" }: { icon: LucideIcon; ton?: keyof typeof TONS; taille?: keyof typeof TAILLES; className?: string }) {
  const [box, ico] = TAILLES[taille];
  return (
    <span className={`grid shrink-0 place-items-center rounded-full ring-1 ${TONS[ton]} ${className}`} style={{ width: box, height: box }}>
      <Icon size={ico} strokeWidth={1.75} aria-hidden />
    </span>
  );
}
