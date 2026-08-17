import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { IdCard, Save, User } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — Lixo Zero" },
      {
        name: "description",
        content: "Veja seus dados, sua sala e o histórico particular das coletas que você registrou.",
      },
      { property: "og:title", content: "Meu perfil — Lixo Zero" },
      {
        property: "og:description",
        content: "Seus dados e o histórico completo das suas coletas no Lixo Zero.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Perfil,
});

const statusBadge = {
  pendente: { label: "Pendente", className: "bg-warning text-warning-foreground" },
  aprovada: { label: "Aprovada", className: "bg-success text-success-foreground" },
  rejeitada: { label: "Rejeitada", className: "bg-destructive text-destructive-foreground" },
} as const;

function Perfil() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState<string | null>(null);
  const [salaId, setSalaId] = useState<string | null>(null);

  const salas = useQuery({
    queryKey: ["salas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("salas").select("id, nome, turno").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const coletas = useQuery({
    queryKey: ["minhas-coletas", me?.userId],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coletas")
        .select("id, quantidade, pontos, status, observacao, created_at, materiais(nome, unidade)")
        .eq("user_id", me!.userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const novoNome = (nome ?? me?.nome ?? "").trim();
      if (novoNome.length < 2) throw new Error("Informe um nome válido");
      const { error } = await supabase
        .from("profiles")
        .update({ nome: novoNome, sala_id: salaId ?? me?.salaId ?? null })
        .eq("id", me!.userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado!");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível salvar."),
  });

  const lista = coletas.data ?? [];
  const aprovadas = lista.filter((c) => c.status === "aprovada");
  const pontos = aprovadas.reduce((acc, c) => acc + Number(c.pontos), 0);
  const pendentes = lista.filter((c) => c.status === "pendente").length;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
        <header>
          <h1 className="font-display text-2xl font-bold">Meu perfil</h1>
          <p className="text-sm text-muted-foreground">
            Seus dados e o histórico particular das suas coletas.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="shadow-card">
            <CardHeader className="pb-1">
              <CardDescription>Pontos aprovados</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {Math.round(pontos * 100) / 100}
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-1">
              <CardDescription>Coletas registradas</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{lista.length}</CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-1">
              <CardDescription>Aguardando aprovação</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{pendentes}</CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-4" /> Meus dados
            </CardTitle>
            <CardDescription>O R.A. é usado para entrar e não pode ser alterado.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>R.A.</Label>
              <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm">
                <IdCard className="size-4 text-muted-foreground" />
                {me?.ra ?? "—"}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="perfil-nome">Nome</Label>
              <Input
                id="perfil-nome"
                value={nome ?? me?.nome ?? ""}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="perfil-sala">Minha sala</Label>
              <Select
                value={salaId ?? me?.salaId ?? ""}
                onValueChange={(v) => setSalaId(v)}
              >
                <SelectTrigger id="perfil-sala">
                  <SelectValue placeholder="Escolha a sala" />
                </SelectTrigger>
                <SelectContent>
                  {salas.data?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome} — {s.turno}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-3">
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                <Save className="size-4" /> Salvar alterações
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Histórico das minhas coletas</CardTitle>
            <CardDescription>Somente você e a coordenação veem esta lista.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {coletas.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : lista.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Você ainda não registrou coletas. Comece em "Registrar coleta".
              </p>
            ) : (
              lista.map((c) => {
                const badge = statusBadge[c.status];
                return (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {c.materiais?.nome} — {Number(c.quantidade)} {c.materiais?.unidade}
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
