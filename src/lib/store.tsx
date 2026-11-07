"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { reference } from "./format";
import { roundAmount } from "./logic";
import { fraisMobileMoney } from "./payments";
import { mapGroup, mapPayment } from "./mappers";
import { supabase } from "./supabase";
import type { AddPolicy, Frequency, Group, GroupType, Member, Payment, PayoutMethod, PayMethod, User } from "./types";

export interface NewGroupInput {
  name: string;
  type: GroupType;
  description?: string;
  amount: number;
  frequency: Frequency;
  startDate: string;
  penalty: number;
  target?: number;
  members: { name: string; phone: string; gestionnaire?: boolean }[];
  shuffle: boolean;
  addPolicy: AddPolicy;
}

export interface GroupUpdate {
  name?: string;
  description?: string | null;
  amount?: number;
  startDate?: string;
  penalty?: number;
  target?: number | null;
  addPolicy?: AddPolicy;
}

interface Ctx {
  ready: boolean; // session vérifiée
  loaded: boolean; // groupes chargés
  user: User | null;
  userId: string | null;
  groups: Group[];
  login: (u: User) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  getGroup: (id: string) => Group | undefined;
  createGroup: (input: NewGroupInput) => Promise<string>;
  addMember: (groupId: string, name: string, phone: string) => Promise<void>;
  recordPayment: (groupId: string, memberId: string, method: PayMethod, amount?: number) => Promise<Payment>;
  /** Paie un ou plusieurs tours (paiement en avance / arriérés). Pour une collecte, utiliser `amount`. */
  recordPayments: (groupId: string, memberId: string, method: PayMethod, opts: { rounds?: number[]; amount?: number }) => Promise<Payment[]>;
  /** Le membre déclare avoir envoyé l'argent au trésorier (en attente de confirmation). */
  declarePayments: (groupId: string, memberId: string, method: PayMethod, opts: { rounds?: number[]; amount?: number; ref?: string }) => Promise<Payment[]>;
  /** Le trésorier confirme (ok = true) ou refuse un paiement déclaré. */
  confirmPayments: (paymentIds: string[], ok: boolean) => Promise<void>;
  setPaymentPhone: (groupId: string, phone: string) => Promise<void>;
  updateGroup: (groupId: string, u: GroupUpdate) => Promise<void>;
  updateMember: (memberId: string, u: { name?: string; phone?: string; role?: Member["role"] }) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  setOrder: (groupId: string, memberIds: string[]) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  updateProfile: (u: User) => Promise<void>;
  setWaveLink: (groupId: string, link: string) => Promise<void>;
  recordPayout: (groupId: string, p: { round: number; memberId?: string | null; beneficiaryName: string; amount: number; method: PayoutMethod; note?: string }) => Promise<void>;
  nextRound: (groupId: string) => Promise<void>;
  joinGroup: (groupId: string) => Promise<void>;
}

const StoreContext = createContext<Ctx | null>(null);



const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    let { data, error } = await supabase
      .from("groups")
      .select("*, members(*), payments(*), payouts(*)")
      .order("created_at", { ascending: false });
    if (error) {
      // base pas encore mise à jour (table payouts absente)
      ({ data, error } = await supabase.from("groups").select("*, members(*), payments(*)").order("created_at", { ascending: false }));
    }
    if (!error && data) setGroups(data.map(mapGroup));
    setLoaded(true);
  }, []);

  // Session existante au démarrage
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (uid) {
        const { data: prof } = await supabase.from("profiles").select("name, phone").eq("id", uid).maybeSingle();
        if (prof) {
          setUserId(uid);
          setUser(prof);
          await reload();
        }
      }
      setReady(true);
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
      setUserId(uid);
      setUser(u);
      await reload();
    },
    [reload]
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
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
        })
        .select("id")
        .single();
      fail(error);

      const people = [
        { name: user!.name, phone: user!.phone, role: "tresorier", profile_id: userId },
        ...input.members
          .filter((m) => m.name.trim())
          .map((m) => ({
            name: m.name.trim(),
            phone: m.phone.replace(/\D/g, ""),
            role: m.gestionnaire && input.addPolicy !== "tresorier" ? "gestionnaire" : "membre",
            profile_id: null,
          })),
      ];
      const positions = people.map((_, i) => i);
      if (input.shuffle) {
        for (let i = positions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [positions[i], positions[j]] = [positions[j], positions[i]];
        }
      }
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
    async (groupId: string, name: string, phone: string) => {
      const g = groups.find((x) => x.id === groupId);
      const { error } = await supabase.from("members").insert({
        group_id: groupId,
        name: name.trim(),
        phone: phone.replace(/\D/g, ""),
        turn_position: g ? g.members.length : 0,
      });
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
    async (groupId: string, memberId: string, method: PayMethod, opts: { rounds?: number[]; amount?: number; ref?: string }) => {
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
      if (u.startDate !== undefined) row.start_date = new Date(u.startDate).toISOString();
      if (u.penalty !== undefined) row.penalty = Math.round(u.penalty);
      if (u.target !== undefined) row.target = u.target;
      if (u.addPolicy !== undefined) row.add_policy = u.addPolicy;
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
      const { error } = await supabase.from("members").delete().eq("id", memberId);
      fail(error);
      await reload();
    },
    [reload]
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

  const updateProfile = useCallback(
    async (u: User) => {
      const phone = u.phone.replace(/\D/g, "");
      const { error } = await supabase.from("profiles").update({ name: u.name.trim(), phone }).eq("id", userId!);
      fail(error);
      setUser({ name: u.name.trim(), phone });
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

  const recordPayout = useCallback(
    async (groupId: string, p: { round: number; memberId?: string | null; beneficiaryName: string; amount: number; method: PayoutMethod; note?: string }) => {
      const { error } = await supabase.from("payouts").insert({
        group_id: groupId,
        round: p.round,
        member_id: p.memberId ?? null,
        beneficiary_name: p.beneficiaryName.trim(),
        amount: Math.round(p.amount),
        method: p.method,
        note: p.note?.trim() || null,
        reference: reference().replace("CTZ-", "VRS-"),
      });
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
    async (groupId: string) => {
      const { error } = await supabase.rpc("join_group", { g: groupId });
      fail(error);
      await reload();
    },
    [reload]
  );

  return (
    <StoreContext.Provider
      value={{ ready, loaded, user, userId, groups, login, logout, reload, getGroup, createGroup, addMember, recordPayment, recordPayments, declarePayments, confirmPayments, setPaymentPhone, setWaveLink, updateGroup, updateMember, removeMember, setOrder, deleteGroup, updateProfile, recordPayout, nextRound, joinGroup }}
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
