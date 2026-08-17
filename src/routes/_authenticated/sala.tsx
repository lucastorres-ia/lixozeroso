import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Users } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/sala")({
  head: () => ({
    meta: [
      { title: "Minha sala — Lixo Zero" },
      {
        name: "description",
        content:
          "Área da sala: pontos totais, posição no ranking e todas as coletas registradas pelos colegas.",
      },
      { property: "og:title", content: "Minha sala — Lixo Zero" },
      {
        property: "og:description",
        content: "Acompanhe os pontos e as coletas da sua sala no Lixo Zero.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SalaPage,
});

const statusBadge = {
  pendente: { label: "Pendente", className: "bg-warning text-warning-foreground" },
  aprovada: { label: "Aprovada", className: "bg-success text-success-foreground" },
  rejeitada: { label: "Rejeitada", className: "bg-destructive text-destructive-foreground" },
} as const;

function SalaPage() {
  const { data: me } = useMe();
  const salaId = me?.salaId ?? null;

  const ranking = useQuery({
    queryKey: ["ranking"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ranking_salas");
      if (error) throw error;
      return data ?? [];
    },
  });

  const coletas = useQuery({
    queryKey: ["coletas-sala", salaId],
    enabled: !!salaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coletas")
        .select(
          "id, quantidade, pontos, status, observacao, created_at, materiais(nome, unidade), profiles!coletas_user_id_profiles_fkey(nome, ra)",
        )
        .eq("sala_id", salaId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!salaId) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-2xl px-4 py-12 text-center">
          <h1 className="font-display text-2xl font-bold">Você ainda não tem sala</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Escolha a sua sala no perfil para acessar a área da sala.
          </p>
          <Button asChild className="mt-4">
            <Link to="/perfil">Ir para o meu perfil</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const lista = ranking.data ?? [];
  const posicao = lista.findIndex((s) => s.sala_id === salaId) + 1;
  const minha = lista.find((s) => s.sala_id === salaId);
  const coletasSala = coletas.data ?? [];
  const alunos = new Set(coletasSala.map((c) => c.profiles?.nome ?? "")).size;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
        <header>
          <h1 className="font-display text-2xl font-bold">
            {minha?.sala_nome ?? me?.salaNome ?? "Minha sala"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Área restrita da sala — visível apenas para quem entrou com R.A. e senha.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="shadow-card">
            <CardHeader className="pb-1">
              <CardDescription className="flex items-center gap-1">
                <Trophy className="size-4" /> Posição no ranking
              </CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {posicao > 0 ? `${posicao}º` : "—"}
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-1">
              <CardDescription>Pontos aprovados da sala</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {Math.round(Number(minha?.pontos ?? 0) * 100) / 100}
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-1">
              <CardDescription className="flex items-center gap-1">
                <Users className="size-4" /> Alunos que registraram
              </CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{alunos}</CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Coletas da sala</CardTitle>
            <CardDescription>
              {coletasSala.length} registro(s) — pontos contam apenas depois da aprovação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {coletas.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : coletasSala.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma coleta registrada nesta sala ainda.
              </p>
            ) : (
              coletasSala.map((c) => {
                const badge = statusBadge[c.status];
                return (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {c.profiles?.nome ?? "Aluno"} · {c.materiais?.nome} —{" "}
                        {Number(c.quantidade)} {c.materiais?.unidade}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleString("pt-BR")}
                        {c.observacao ? ` · ${c.observacao}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{Number(c.pontos)} pts</span>
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
