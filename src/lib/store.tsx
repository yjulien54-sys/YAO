"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { reference } from "./format";
import { roundAmount } from "./logic";
import { fraisMobileMoney } from "./payments";
import { mapGroup, mapPayment } from "./mappers";
import { supabase } from "./supabase";
import { CLE_SESSION, verifierCode as verifierCodeSecret } from "./verrou";
import type { AddPolicy, PenaltyDestination, PayoutNature, Frequency, Group, GroupType, Member, Payment, PayoutMethod, PayMethod, User } from "./types";

export interface NewGroupInput {
  name: string;
  type: GroupType;
  description?: string;
  amount: number;
  frequency: Frequency;
  startDate: string;
  penalty: number;
  target?: number;
  members: { name: string; phone: string; gestionnaire?: boolean; parts?: number }[];
  shuffle: boolean;
  addPolicy: AddPolicy;
  mesParts?: number;
  penaltyDestination?: PenaltyDestination;
  donCause?: string;
}

export interface GroupUpdate {
  name?: string;
  description?: string | null;
  amount?: number;
  frequency?: Frequency;
  startDate?: string;
  penalty?: number;
  target?: number | null;
  addPolicy?: AddPolicy;
  penaltyDestination?: PenaltyDestination;
  donCause?: string | null;
}

interface Ctx {
  ready: boolean;
  bloque: { motif: string | null } | null; // session vérifiée
  loaded: boolean; // groupes chargés
  user: User | null;
  userId: string | null;
  groups: Group[];
  login: (u: User) => Promise<void>;
  /** Connexion par SMS : envoie le code au numéro */
  envoyerCode: (phone: string) => Promise<void>;
  /** Connexion par SMS : vérifie le code et ouvre la session */
  verifierCode: (u: User, code: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  getGroup: (id: string) => Group | undefined;
  createGroup: (input: NewGroupInput) => Promise<string>;
  addMember: (groupId: string, name: string, phone: string, parts?: number) => Promise<void>;
  recordPayment: (groupId: string, memberId: string, method: PayMethod, amount?: number) => Promise<Payment>;
  /** Paie un ou plusieurs tours (paiement en avance / arriérés). Pour une collecte, utiliser `amount`. */
  recordPayments: (groupId: string, memberId: string, method: PayMethod, opts: { rounds?: number[]; amount?: number }) => Promise<Payment[]>;
  /** Le membre déclare avoir envoyé l'argent au trésorier (en attente de confirmation). */
  declarePayments: (groupId: string, memberId: string, method: PayMethod, opts: { rounds?: number[]; amount?: number; ref?: string; cotiz?: boolean }) => Promise<Payment[]>;
  /** Le trésorier confirme (ok = true) ou refuse un paiement déclaré. */
  confirmPayments: (paymentIds: string[], ok: boolean) => Promise<void>;
  setPaymentPhone: (groupId: string, phone: string) => Promise<void>;
  updateGroup: (groupId: string, u: GroupUpdate) => Promise<void>;
  updateMember: (memberId: string, u: { name?: string; phone?: string; role?: Member["role"] }) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  setOrder: (groupId: string, memberIds: string[]) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  setTiragePrevu: (groupId: string, date: string | null) => Promise<void>;
  lancerTirage: (groupId: string) => Promise<string[]>;
  updateProfile: (u: User) => Promise<void>;
  accepterReglement: (groupId: string, texte: string) => Promise<void>;
  setWaveLink: (groupId: string, link: string) => Promise<void>;
  recordPayout: (groupId: string, p: { round: number; memberId?: string | null; beneficiaryName: string; amount: number; method: PayoutMethod; note?: string; nature?: PayoutNature }) => Promise<{ statut: "valide" | "en_attente"; requis: number }>;
  validerVersement: (demandeId: string, accord: boolean) => Promise<string>;
  annulerVersement: (demandeId: string) => Promise<void>;
  nextRound: (groupId: string) => Promise<void>;
  joinGroup: (groupId: string, invitation?: { cle?: string | null; par?: string | null }) => Promise<"membre" | "en_attente" | "aucun">;
  repondreDemande: (memberId: string, accepter: boolean) => Promise<void>;
  retrouverCompte: (telephone: string, naissance: string, code: string) => Promise<{ ok: boolean; raison?: string; restants?: number }>;
  quitterGroupe: (groupId: string) => Promise<void>;
  annulerDeclaration: (paymentIds: string[]) => Promise<void>;
}

const StoreContext = createContext<Ctx | null>(null);

/* Cache local : affiche tout de suite les groupes déjà connus, puis les met à jour */
const CACHE = "cotiz:cache:v3";
type Cache = { userId: string; user: User; groups: Group[] };
const lireCache = (): Cache | null => {
  try {
    const raw = localStorage.getItem(CACHE);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
};
const ecrireCache = (c: Cache | null) => {
  try {
    if (c) localStorage.setItem(CACHE, JSON.stringify(c));
    else localStorage.removeItem(CACHE);
  } catch {}
};



const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [bloque, setBloque] = useState<{ motif: string | null } | null>(null);

  // Compte bloqué par l'administrateur ? (mise à jour SQL n°14 ; sans elle, rien ne change)
  useEffect(() => {
    if (!userId) return setBloque(null);
    supabase.rpc("mon_blocage").then(({ data, error }) => {
      const d = data as { bloque?: boolean; motif?: string | null } | null;
      setBloque(!error && d?.bloque ? { motif: d.motif ?? null } : null);
    });
  }, [userId, groups]);
  // « Santé de l'appli » (SQL n°31) : compte une ouverture, une fois par chargement ; sans la mise à jour, l'erreur est ignorée
  useEffect(() => {
    if (!userId) return;
    supabase.rpc("je_suis_la").then(() => {}, () => {});
  }, [userId]);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    let { data, error } = await supabase
      .from("groups")
      .select("*, members(*), payments(*), payouts(*), engagements(*), demandes_versement(*, validations_versement(*))")
      .order("created_at", { ascending: false });
    if (error) {
      // base pas encore mise à jour (validation des versements absente)
      ({ data, error } = await supabase.from("groups").select("*, members(*), payments(*), payouts(*), engagements(*)").order("created_at", { ascending: false }));
    }
    if (error) {
      // base pas encore mise à jour (table engagements absente)
      ({ data, error } = await supabase.from("groups").select("*, members(*), payments(*), payouts(*)").order("created_at", { ascending: false }));
    }
    if (error) {
      // base pas encore mise à jour (table payouts absente)
      ({ data, error } = await supabase.from("groups").select("*, members(*), payments(*)").order("created_at", { ascending: false }));
    }
    if (!error && data) {
      const gs = data.map(mapGroup);
      setGroups(gs);
      const c = lireCache();
      const uid = (await supabase.auth.getSession()).data.session?.user.id;
      if (uid && c?.userId === uid) ecrireCache({ ...c, groups: gs });
    }
    setLoaded(true);
  }, []);

  // Session existante au démarrage
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession(); // lecture locale, instantanée
      const uid = data.session?.user.id;
      if (!uid) {
        setReady(true);
        return;
      }
      // 1. Affichage immédiat à partir du cache (pas d'attente réseau)
      const c = lireCache();
      if (c && c.userId === uid) {
        setUserId(uid);
        setUser(c.user);
        setGroups(c.groups);
        setLoaded(true);
        setReady(true);
      }
      // 2. Mise à jour en arrière-plan
      const { data: prof } = await supabase.from("profiles").select("name, phone").eq("id", uid).maybeSingle();
      // Compte réuni dans un autre (même numéro, connexion faite sur un autre appareil) : on déconnecte cet appareil
      const { data: fusionne } = await supabase.rpc("mon_compte_fusionne");
      if (fusionne === true) {
        try { sessionStorage.setItem("cotiz:compte-reuni", "1"); } catch {}
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        ecrireCache(null);
        setUser(null);
        setUserId(null);
        setGroups([]);
        setReady(true);
        return;
      }
      if (prof) {
        setUserId(uid);
        setUser(prof);
        ecrireCache({ userId: uid, user: prof, groups: c && c.userId === uid ? c.groups : [] });
        setReady(true);
        await reload();
        // Reconnaissance par numéro : si de nouvelles places ont été rattachées, on recharge
        const { data: n } = await supabase.rpc("rattacher_par_numero");
        if (typeof n === "number" && n > 0) await reload();
      } else {
        ecrireCache(null);
        setReady(true);
      }
    })();
  }, [reload]);

  // Temps réel : on recharge quand un paiement, un membre ou un groupe change
  useEffect(() => {
    if (!userId) return;
    const schedule = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(reload, 300);
    };
    const channel = supabase
      .channel("cotiz-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "payouts" }, schedule)
      .subscribe();
    const onFocus = () => schedule();
    window.addEventListener("focus", onFocus);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId, reload]);

  const login = useCallback(
    async (u: User) => {
      let { data } = await supabase.auth.getSession();
      if (!data.session) {
        const res = await supabase.auth.signInAnonymously();
        fail(res.error);
        data = { session: res.data.session };
      }
      const uid = data.session!.user.id;
      const { error } = await supabase.from("profiles").upsert({ id: uid, name: u.name, phone: u.phone });
      fail(error);
      // Reconnaissance par numéro : retrouve les groupes où un trésorier a ajouté ce numéro
      await supabase.rpc("rattacher_par_numero");
      setUserId(uid);
      setUser(u);
      ecrireCache({ userId: uid, user: u, groups: [] });
      await reload();
    },
    [reload]
  );

  // Connexion par SMS (activée par NEXT_PUBLIC_CONNEXION=sms)
  const modeVerif = useRef<"sms" | "phone_change">("sms");
  const e164 = (phone: string) => "+225" + phone.replace(/\D/g, "").slice(-10);

  const envoyerCode = useCallback(async (phone: string) => {
    const { data } = await supabase.auth.getSession();
    // Compte existant sans vérification : on vérifie son numéro en gardant ses groupes
    if (data.session?.user.is_anonymous) {
      const { error } = await supabase.auth.updateUser({ phone: e164(phone) });
      if (!error) {
        modeVerif.current = "phone_change";
        return;
      }
      await supabase.auth.signOut(); // numéro déjà vérifié sur un autre compte : connexion normale
    }
    const { error } = await supabase.auth.signInWithOtp({ phone: e164(phone) });
    fail(error);
    modeVerif.current = "sms";
  }, []);

  const verifierCode = useCallback(
    async (u: User, code: string) => {
      const { data, error } = await supabase.auth.verifyOtp({ phone: e164(u.phone), token: code.trim(), type: modeVerif.current });
      fail(error);
      const uid = data.user?.id ?? data.session?.user.id;
      if (!uid) throw new Error("Code invalide");
      const phone = u.phone.replace(/\D/g, "").slice(-10);
      const { error: e2 } = await supabase.from("profiles").upsert({ id: uid, name: u.name.trim(), phone });
      fail(e2);
      // Numéro vérifié : on rattache ses places, y compris celles d'anciens comptes non vérifiés
      await supabase.rpc("rattacher_numero_verifie");
      await supabase.rpc("rattacher_par_numero");
      setUserId(uid);
      setUser({ name: u.name.trim(), phone });
      ecrireCache({ userId: uid, user: { name: u.name.trim(), phone }, groups: [] });
      await reload();
    },
    [reload]
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    ecrireCache(null);
    // Déconnexion : le délai de grâce du code ne compte plus
    try { Object.keys(localStorage).filter((k) => k.startsWith("cotiz:presence:")).forEach((k) => localStorage.removeItem(k)); } catch {}
    setUser(null);
    setUserId(null);
    setGroups([]);
    setLoaded(false);
  }, []);

  const getGroup = useCallback((id: string) => groups.find((g) => g.id === id), [groups]);

  const createGroup = useCallback(
    async (input: NewGroupInput) => {
      const isCollecte = input.type === "collecte";
      const { data: g, error } = await supabase
        .from("groups")
        .insert({
          name: input.name.trim(),
          type: input.type,
          description: input.description?.trim() || null,
          amount: isCollecte ? 0 : input.amount,
          frequency: isCollecte ? "unique" : input.frequency,
          start_date: new Date(input.startDate).toISOString(),
          penalty: isCollecte ? 0 : input.penalty,
          target: isCollecte ? input.target ?? null : null,
          add_policy: input.addPolicy,
          penalty_destination: input.penaltyDestination ?? "beneficiaire",
          don_cause: input.penaltyDestination === "don" ? input.donCause?.trim() || null : null,
          // tirage au sort public prévu : à lancer depuis le groupe
          tirage_prevu: input.type === "tontine" && input.shuffle ? new Date(input.startDate).toISOString() : null,
        })
        .select("id")
        .single();
      fail(error);

      // Une ligne par part (« main ») : une personne peut avoir 2 ou 3 parts dans une tontine
      const avecParts = <T extends { name: string }>(p: T, n: number) =>
        Array.from({ length: Math.max(1, Math.min(3, n)) }, (_, k) => ({ ...p, name: k === 0 ? p.name : `${p.name} (part ${k + 1})` }));
      const tontine = input.type === "tontine";
      const people = [
        ...avecParts({ name: user!.name, phone: user!.phone, role: "tresorier", profile_id: userId }, tontine ? input.mesParts ?? 1 : 1),
        ...input.members
          .filter((m) => m.name.trim())
          .flatMap((m) =>
            avecParts(
              {
                name: m.name.trim(),
                phone: m.phone.replace(/\D/g, ""),
                role: m.gestionnaire && input.addPolicy !== "tresorier" ? "gestionnaire" : "membre",
                profile_id: null as string | null,
              },
              tontine ? m.parts ?? 1 : 1
            )
          ),
      ];
      const positions = people.map((_, i) => i);
      const res = await supabase
        .from("members")
        .insert(people.map((p, i) => ({ ...p, group_id: g!.id, turn_position: positions[i] })));
      fail(res.error);
      await reload();
      return g!.id as string;
    },
    [user, userId, reload]
  );

  const addMember = useCallback(
    async (groupId: string, name: string, phone: string, parts = 1) => {
      const g = groups.find((x) => x.id === groupId);
      const base = g ? g.members.length : 0;
      const n = Math.max(1, Math.min(3, parts));
      const { error } = await supabase.from("members").insert(
        Array.from({ length: n }, (_, k) => ({
          group_id: groupId,
          name: k === 0 ? name.trim() : `${name.trim()} (part ${k + 1})`,
          phone: phone.replace(/\D/g, ""),
          turn_position: base + k,
        }))
      );
      fail(error);
      await reload();
    },
    [groups, reload]
  );

  const recordPayments = useCallback(
    async (groupId: string, memberId: string, method: PayMethod, opts: { rounds?: number[]; amount?: number }) => {
      const g = groups.find((x) => x.id === groupId)!;
      const rows =
        g.type === "collecte"
          ? [{ round: 1, amount: opts.amount ?? 0, penalty: 0 }]
          : (opts.rounds?.length ? opts.rounds : [g.currentRound]).map((r) => {
              const due = roundAmount(g, r);
              return { round: r, amount: due.base, penalty: due.penalty };
            });
      const { data, error } = await supabase
        .from("payments")
        .insert(
          rows.map((r) => ({
            group_id: groupId,
            member_id: memberId,
            round: r.round,
            amount: r.amount,
            penalty: r.penalty,
            fees: fraisMobileMoney(r.amount + r.penalty, method),
            method,
            status: "reussi",
            reference: reference(),
          }))
        )
        .select();
      fail(error);
      const ps = (data ?? []).map(mapPayment);
      setGroups((gs) => gs.map((x) => (x.id === groupId ? { ...x, payments: [...x.payments, ...ps] } : x)));
      reload();
      return ps;
    },
    [groups, reload]
  );

  const declarePayments = useCallback(
    async (groupId: string, memberId: string, method: PayMethod, opts: { rounds?: number[]; amount?: number; ref?: string; cotiz?: boolean }) => {
      const g = groups.find((x) => x.id === groupId)!;
      const rows =
        g.type === "collecte"
          ? [{ round: 1, amount: opts.amount ?? 0, penalty: 0 }]
          : (opts.rounds?.length ? opts.rounds : [g.currentRound]).map((r) => {
              const due = roundAmount(g, r);
              return { round: r, amount: due.base, penalty: due.penalty };
            });
      const tx = (opts.ref?.trim() || `DECL-${reference().slice(4)}`).slice(0, 80);
      const { data, error } = await supabase
        .from("payments")
        .insert(
          rows.map((r) => ({
            group_id: groupId,
            member_id: memberId,
            round: r.round,
            amount: r.amount,
            penalty: r.penalty,
            fees: 0,
            method,
            status: "en_attente",
            transaction_id: tx,
            reference: reference(),
            ...(opts.cotiz ? { encaisse_cotiz: true } : {}),
          }))
        )
        .select();
      fail(error);
      await reload();
      return (data ?? []).map(mapPayment);
    },
    [groups, reload]
  );

  const confirmPayments = useCallback(
    async (paymentIds: string[], ok: boolean) => {
      const { error } = await supabase
        .from("payments")
        .update({ status: ok ? "reussi" : "echoue" })
        .in("id", paymentIds)
        .eq("status", "en_attente");
      fail(error);
      await reload();
    },
    [reload]
  );

  const setPaymentPhone = useCallback(
    async (groupId: string, phone: string) => {
      const { error } = await supabase.from("groups").update({ payment_phone: phone.replace(/\D/g, "") || null }).eq("id", groupId);
      fail(error);
      await reload();
    },
    [reload]
  );

  const updateGroup = useCallback(
    async (groupId: string, u: GroupUpdate) => {
      const row: Record<string, unknown> = {};
      if (u.name !== undefined) row.name = u.name.trim();
      if (u.description !== undefined) row.description = u.description?.trim() || null;
      if (u.amount !== undefined) row.amount = Math.round(u.amount);
      if (u.frequency !== undefined) row.frequency = u.frequency;
      if (u.startDate !== undefined) row.start_date = new Date(u.startDate).toISOString();
      if (u.penalty !== undefined) row.penalty = Math.round(u.penalty);
      if (u.target !== undefined) row.target = u.target;
      if (u.addPolicy !== undefined) row.add_policy = u.addPolicy;
      if (u.penaltyDestination !== undefined) row.penalty_destination = u.penaltyDestination;
      if (u.donCause !== undefined) row.don_cause = u.donCause?.trim() || null;
      const { error } = await supabase.from("groups").update(row).eq("id", groupId);
      fail(error);
      await reload();
    },
    [reload]
  );

  const updateMember = useCallback(
    async (memberId: string, u: { name?: string; phone?: string; role?: Member["role"] }) => {
      const row: Record<string, unknown> = {};
      if (u.name !== undefined) row.name = u.name.trim();
      if (u.phone !== undefined) row.phone = u.phone.replace(/\D/g, "");
      if (u.role !== undefined) row.role = u.role;
      const { error } = await supabase.from("members").update(row).eq("id", memberId);
      fail(error);
      await reload();
    },
    [reload]
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      const g = groups.find((x) => x.members.some((m) => m.id === memberId));
      const aDesPaiements = !!g && [...g.payments, ...g.pending].some((p) => p.memberId === memberId);
      // Un membre qui a des paiements est archivé (son historique reste), sinon il est supprimé
      const { error } = aDesPaiements
        ? await supabase.from("members").update({ archive: true }).eq("id", memberId)
        : await supabase.from("members").delete().eq("id", memberId);
      fail(error);
      await reload();
    },
    [groups, reload]
  );

  const setOrder = useCallback(
    async (groupId: string, memberIds: string[]) => {
      // une mise à jour par membre (positions 0, 1, 2…)
      for (let i = 0; i < memberIds.length; i++) {
        const { error } = await supabase.from("members").update({ turn_position: i }).eq("id", memberIds[i]).eq("group_id", groupId);
        fail(error);
      }
      await reload();
    },
    [reload]
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      const { error } = await supabase.from("groups").delete().eq("id", groupId);
      fail(error);
      await reload();
    },
    [reload]
  );

  const setTiragePrevu = useCallback(
    async (groupId: string, date: string | null) => {
      const { error } = await supabase.from("groups").update({ tirage_prevu: date ? new Date(date).toISOString() : null }).eq("id", groupId);
      fail(error);
      await reload();
    },
    [reload]
  );

  /** Tirage au sort de l'ordre de passage (une seule fois, visible par tous) */
  const lancerTirage = useCallback(
    async (groupId: string) => {
      const g = groups.find((x) => x.id === groupId)!;
      if (g.tirageFait) throw new Error("Le tirage a déjà été fait");
      const ids = g.members.map((m) => m.id);
      const alea = new Uint32Array(ids.length);
      crypto.getRandomValues(alea);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = alea[i] % (i + 1);
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      for (let i = 0; i < ids.length; i++) {
        const { error } = await supabase.from("members").update({ turn_position: i }).eq("id", ids[i]).eq("group_id", groupId);
        fail(error);
      }
      const { error } = await supabase
        .from("groups")
        .update({ tirage_fait: new Date().toISOString(), tirage_par: user?.name ?? "Le trésorier" })
        .eq("id", groupId);
      fail(error);
      await reload();
      return ids;
    },
    [groups, reload, user]
  );

  const accepterReglement = useCallback(
    async (groupId: string, texte: string) => {
      const { error } = await supabase.from("engagements").insert({ group_id: groupId, nom: user!.name, telephone: user!.phone, texte });
      fail(error);
      await reload();
    },
    [user, reload]
  );

  const updateProfile = useCallback(
    async (u: User) => {
      const phone = u.phone.replace(/\D/g, "");
      const { error } = await supabase.from("profiles").update({ name: u.name.trim(), phone }).eq("id", userId!);
      fail(error);
      setUser({ name: u.name.trim(), phone });
      const c = lireCache();
      if (c) ecrireCache({ ...c, user: { name: u.name.trim(), phone } });
    },
    [userId]
  );

  const setWaveLink = useCallback(
    async (groupId: string, link: string) => {
      const { error } = await supabase.from("groups").update({ wave_link: link.trim() || null }).eq("id", groupId);
      fail(error);
      await reload();
    },
    [reload]
  );

  const recordPayment = useCallback(
    async (groupId: string, memberId: string, method: PayMethod, amount?: number) =>
      (await recordPayments(groupId, memberId, method, { amount }))[0],
    [recordPayments]
  );

  // Versement : demandé par le trésorier, validé par 2 ou 3 responsables (mise à jour SQL n°13)
  const recordPayout = useCallback(
    async (groupId: string, p: { round: number; memberId?: string | null; beneficiaryName: string; amount: number; method: PayoutMethod; note?: string; nature?: PayoutNature }): Promise<{ statut: "valide" | "en_attente"; requis: number }> => {
      const r = await supabase.rpc("demander_versement", {
        g: groupId, tour: p.round, membre: p.memberId ?? null, beneficiaire: p.beneficiaryName.trim(),
        montant: Math.round(p.amount), moyen: p.method, nat: p.nature ?? "versement", remarque: p.note?.trim() || null,
      });
      if (!r.error) {
        await reload();
        return r.data as { statut: "valide" | "en_attente"; requis: number };
      }
      if (r.error.code !== "PGRST202") throw new Error(r.error.message);
      // Ancienne base (sans la mise à jour n°13) : versement direct
      const { error } = await supabase.from("payouts").insert({
        group_id: groupId,
        round: p.round,
        member_id: p.memberId ?? null,
        beneficiary_name: p.beneficiaryName.trim(),
        amount: Math.round(p.amount),
        method: p.method,
        note: p.note?.trim() || null,
        ...(p.nature && p.nature !== "versement" ? { nature: p.nature } : {}),
        reference: reference().replace("CTZ-", "VRS-"),
      });
      fail(error);
      await reload();
      return { statut: "valide", requis: 1 };
    },
    [reload]
  );

  const validerVersement = useCallback(
    async (demandeId: string, accord: boolean) => {
      const { data, error } = await supabase.rpc("valider_versement", { demande: demandeId, accord });
      fail(error);
      await reload();
      return (data as { statut: string }).statut;
    },
    [reload]
  );

  const annulerVersement = useCallback(
    async (demandeId: string) => {
      const { error } = await supabase.rpc("annuler_versement", { demande: demandeId });
      fail(error);
      await reload();
    },
    [reload]
  );

  const nextRound = useCallback(
    async (groupId: string) => {
      const g = groups.find((x) => x.id === groupId)!;
      const { error } = await supabase.from("groups").update({ current_round: g.currentRound + 1 }).eq("id", groupId);
      fail(error);
      await reload();
    },
    [groups, reload]
  );

  const joinGroup = useCallback(
    async (groupId: string, invitation: { cle?: string | null; par?: string | null } = {}) => {
      let { error } = await supabase.rpc("join_group", { g: groupId, cle: invitation.cle ?? null, par: invitation.par ?? null });
      // Mise à jour SQL n°15 pas encore faite : ancienne version (sans clé)
      if (error && /function|schema cache|argument/i.test(error.message)) ({ error } = await supabase.rpc("join_group", { g: groupId }));
      fail(error);
      await reload();
      const { data, error: e2 } = await supabase.rpc("etat_adhesion", { g: groupId });
      return (e2 ? "membre" : data) as "membre" | "en_attente" | "aucun";
    },
    [reload]
  );

  // Nouveau téléphone : le serveur vérifie numéro + date de naissance + code, puis ouvre la session du compte
  const retrouverCompte = useCallback(
    async (telephone: string, naissance: string, code: string) => {
      const res = await fetch("/api/connexion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telephone, naissance, code }) }).catch(() => null);
      if (!res) return { ok: false, raison: "reseau" };
      const r = (await res.json().catch(() => ({}))) as { ok?: boolean; jeton?: string; raison?: string; restants?: number };
      if (!r.ok || !r.jeton) return { ok: false, raison: r.raison ?? "erreur", restants: r.restants };
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: r.jeton, type: "magiclink" });
      if (error || !data.session) return { ok: false, raison: "erreur" };
      const uid = data.session.user.id;
      const { data: prof } = await supabase.from("profiles").select("name, phone").eq("id", uid).maybeSingle();
      if (!prof) return { ok: false, raison: "erreur" };
      // Le code vient d'être vérifié : on garde sa copie chiffrée sur ce téléphone et on ouvre directement
      await verifierCodeSecret(uid, code).catch(() => {});
      try { sessionStorage.setItem(CLE_SESSION, "1"); } catch {}
      setUserId(uid);
      setUser(prof);
      ecrireCache({ userId: uid, user: prof, groups: [] });
      await reload();
      return { ok: true };
    },
    [reload]
  );

  // Quitter un groupe (un membre ; le trésorier, lui, supprime le groupe)
  const quitterGroupe = useCallback(
    async (groupId: string) => {
      const { error } = await supabase.rpc("quitter_groupe", { g: groupId });
      fail(error);
      await reload();
    },
    [reload]
  );

  // Le trésorier ou un co-gestionnaire accepte (ou refuse) une personne arrivée par le lien
  const repondreDemande = useCallback(
    async (memberId: string, accepter: boolean) => {
      const { error } = accepter
        ? await supabase.from("members").update({ en_attente: false }).eq("id", memberId)
        : await supabase.from("members").delete().eq("id", memberId);
      fail(error);
      await reload();
    },
    [reload]
  );

  // Le membre annule sa déclaration tant qu'elle n'est pas confirmée
  const annulerDeclaration = useCallback(
    async (paymentIds: string[]) => {
      const { data, error } = await supabase.from("payments").delete().in("id", paymentIds).eq("status", "en_attente").select("id");
      fail(error);
      if (!data?.length) throw new Error("ta déclaration a peut-être déjà été confirmée par le trésorier");
      await reload();
    },
    [reload]
  );

  return (
    <StoreContext.Provider
      value={{ ready, bloque, loaded, user, userId, groups, login, envoyerCode, verifierCode, logout, reload, getGroup, createGroup, addMember, recordPayment, recordPayments, declarePayments, confirmPayments, setPaymentPhone, setWaveLink, updateGroup, updateMember, removeMember, setOrder, deleteGroup, setTiragePrevu, lancerTirage, updateProfile, accepterReglement, recordPayout, nextRound, joinGroup, repondreDemande, annulerDeclaration, retrouverCompte, quitterGroupe, validerVersement, annulerVersement }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore doit être utilisé dans <StoreProvider>");
  return ctx;
}

/** Le membre correspondant à l'utilisateur connecté dans un groupe */
export function useMe(g?: Group) {
  const { userId } = useStore();
  if (!g || !userId) return undefined;
  return g.members.find((m) => m.profileId === userId);
}
