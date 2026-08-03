import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Leaf, Recycle, Trophy } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EcoColeta — Ranking de coletas por sala" },
      {
        name: "description",
        content:
          "Veja o ranking das salas, os pontos acumulados e registre as coletas de recicláveis da sua turma.",
      },
      { property: "og:title", content: "EcoColeta — Ranking de coletas por sala" },
      {
        property: "og:description",
        content: "Cada coleta registrada vira pontos para a sua sala no ranking da escola.",
      },
    ],
  }),
  component: Home,
});

const medalha = ["bg-accent text-accent-foreground", "bg-secondary text-secondary-foreground", "bg-muted text-muted-foreground"];

function Home() {
  const { data: me } = useMe();

  const ranking = useQuery({
    queryKey: ["ranking"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ranking_salas");
      if (error) throw error;
      return data ?? [];
    },
  });

  const materiais = useQuery({
    queryKey: ["materiais", "ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais")
        .select("id, nome, unidade, pontos_por_unidade")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalPontos = (ranking.data ?? []).reduce((acc, r) => acc + Number(r.pontos), 0);
  const totalQuantidade = (ranking.data ?? []).reduce((acc, r) => acc + Number(r.quantidade_total), 0);

  return (
    <AppShell>
      <section className="bg-hero-gradient text-primary-foreground">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 md:grid-cols-[1.2fr_1fr] md:items-center md:py-20">
          <div>
            <Badge className="bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/20">
              <Leaf className="mr-1 size-3" /> Projeto de coleta seletiva
            </Badge>
            <h1 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">
              Cada coleta da sua sala vale pontos no ranking da escola.
            </h1>
            <p className="mt-4 max-w-xl text-primary-foreground/85">
              Registre tampinhas, óleo, papel, plástico, metal e vidro. A coordenação confere cada
              registro e os pontos entram automaticamente na classificação das turmas.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link to={me ? "/painel" : "/auth"}>
                  {me ? "Registrar coleta" : "Entrar e registrar"}
                </Link>
              </Button>
              {me?.isAdmin ? (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <Link to="/admin">Painel do administrador</Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card className="border-none bg-primary-foreground/10 text-primary-foreground shadow-none">
              <CardContent className="p-5">
                <Trophy className="size-5 opacity-80" />
                <p className="mt-3 text-3xl font-bold">{totalPontos.toLocaleString("pt-BR")}</p>
                <p className="text-xs opacity-80">pontos aprovados</p>
              </CardContent>
            </Card>
            <Card className="border-none bg-primary-foreground/10 text-primary-foreground shadow-none">
              <CardContent className="p-5">
                <Recycle className="size-5 opacity-80" />
                <p className="mt-3 text-3xl font-bold">{totalQuantidade.toLocaleString("pt-BR")}</p>
                <p className="text-xs opacity-80">volume total coletado</p>
              </CardContent>
            </Card>
            <Card className="col-span-2 border-none bg-primary-foreground/10 text-primary-foreground shadow-none">
              <CardContent className="p-5">
                <Award className="size-5 opacity-80" />
                <p className="mt-3 text-lg font-semibold">
                  {ranking.data?.[0]?.sala_nome ?? "Sem líder ainda"}
                </p>
                <p className="text-xs opacity-80">sala na liderança</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="size-5 text-primary" /> Ranking das salas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ranking.isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : ranking.data?.length ? (
                ranking.data.map((sala, i) => (
                  <div
                    key={sala.sala_id}
                    className="flex items-center gap-4 rounded-xl border border-border/70 bg-card px-4 py-3"
                  >
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        medalha[i] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{sala.sala_nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {sala.turno} · {sala.total_coletas} coleta(s) aprovada(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg font-bold text-primary">
                        {Number(sala.pontos).toLocaleString("pt-BR")}
                      </p>
                      <p className="text-[11px] text-muted-foreground">pontos</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-6 text-sm text-muted-foreground">
                  Nenhuma sala cadastrada ainda.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Recycle className="size-5 text-primary" /> Tabela de pontos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {materiais.data?.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-sm"
                >
                  <span>{m.nome}</span>
                  <span className="font-medium">
                    {Number(m.pontos_por_unidade)} pts / {m.unidade}
                  </span>
                </div>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">
                Os valores são definidos pela coordenação no painel de administração.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
