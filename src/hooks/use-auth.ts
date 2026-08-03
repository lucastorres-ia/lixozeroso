import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Me = {
  userId: string;
  email: string | null;
  nome: string;
  salaId: string | null;
  salaNome: string | null;
  isAdmin: boolean;
  hasAnyAdmin: boolean;
} | null;

export const meQueryOptions = {
  queryKey: ["me"] as const,
  queryFn: async (): Promise<Me> => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return null;

    const [{ data: profile }, { data: roles }, { count: adminCount }] = await Promise.all([
      supabase.from("profiles").select("nome, sala_id, salas(nome)").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin"),
    ]);

    return {
      userId: user.id,
      email: user.email ?? null,
      nome: profile?.nome || user.email?.split("@")[0] || "Aluno",
      salaId: profile?.sala_id ?? null,
      salaNome: (profile?.salas as { nome: string } | null)?.nome ?? null,
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
      hasAnyAdmin: (adminCount ?? 0) > 0,
    };
  },
  staleTime: 30_000,
};

export function useMe() {
  return useQuery(meQueryOptions);
}
