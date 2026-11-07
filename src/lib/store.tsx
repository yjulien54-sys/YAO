"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { reference } from "./format";
import { amountDue } from "./logic";
import { supabase } from "./supabase";
import type { Frequency, Group, GroupType, Member, Payment, PayMethod, User } from "./types";

export interface NewGroupInput {
  name: string;
  type: GroupType;
  description?: string;
  amount: number;
  frequency: Frequency;
  startDate: string;
  penalty: number;
  target?: number;
  members: { name: string; phone: string }[];
  shuffle: boolean;
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
  nextRound: (groupId: string) => Promise<void>;
  joinGroup: (groupId: string) => Promise<void>;
}

const StoreContext = createContext<Ctx | null>(null);

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapPayment = (p: any): Payment => ({
  id: p.id,
  memberId: p.member_id,
  amount: p.amount,
  penalty: p.penalty,
  method: p.method,
  round: p.round,
  date: p.created_at,
  reference: p.reference,
});

const mapGroup = (r: any): Group => {
  const members: (Member & { pos: number })[] = (r.members ?? [])
    .map((m: any) => ({ id: m.id, profileId: m.profile_id, name: m.name, phone: m.phone, role: m.role, pos: m.turn_position }))
    .sort((a: any, b: any) => a.pos - b.pos);
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    description: r.description ?? undefined,
    amount: r.amount,
    frequency: r.frequency,
    startDate: r.start_date,
    penalty: r.penalty,
    target: r.target ?? undefined,
    members: members.map(({ pos: _pos, ...m }) => m), // eslint-disable-line @typescript-eslint/no-unused-vars
    order: members.map((m) => m.id),
    currentRound: r.current_round,
    payments: (r.payments ?? []).map(mapPayment).sort((a: Payment, b: Payment) => a.date.localeCompare(b.date)),
    createdAt: r.created_at,
  };
};
/* eslint-enable @typescript-eslint/no-explicit-any */

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
    const { data, error } = await supabase
      .from("groups")
      .select("*, members(*), payments(*)")
      .order("created_at", { ascending: false });
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
        })
        .select("id")
        .single();
      fail(error);

      const people = [
        { name: user!.name, phone: user!.phone, role: "tresorier", profile_id: userId },
        ...input.members
          .filter((m) => m.name.trim())
          .map((m) => ({ name: m.name.trim(), phone: m.phone.replace(/\D/g, ""), role: "membre", profile_id: null })),
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

  const recordPayment = useCallback(
    async (groupId: string, memberId: string, method: PayMethod, amount?: number) => {
      const g = groups.find((x) => x.id === groupId)!;
      const due = amountDue(g);
      const { data, error } = await supabase
        .from("payments")
        .insert({
          group_id: groupId,
          member_id: memberId,
          round: g.currentRound,
          amount: g.type === "collecte" ? amount ?? 0 : due.base,
          penalty: g.type === "collecte" ? 0 : due.penalty,
          method,
          reference: reference(),
        })
        .select()
        .single();
      fail(error);
      const p = mapPayment(data);
      setGroups((gs) => gs.map((x) => (x.id === groupId ? { ...x, payments: [...x.payments, p] } : x)));
      reload();
      return p;
    },
    [groups, reload]
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
      value={{ ready, loaded, user, userId, groups, login, logout, reload, getGroup, createGroup, addMember, recordPayment, nextRound, joinGroup }}
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
