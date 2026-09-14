import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { CheckCircle2, Camera, Clock, ShieldPlus, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { AppShell } from "@/components/AppShell";
import { FotoColeta } from "@/components/FotoColeta";
import { verificarFoto } from "@/lib/moderacao.functions";
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

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Minhas coletas — Lixo Zero" },
      {
        name: "description",
        content: "Registre uma nova coleta da sua sala e acompanhe a aprovação dos seus pontos.",
      },
      { property: "og:title", content: "Minhas coletas — Lixo Zero" },
      {
        property: "og:description",
        content: "Registre coletas e acompanhe seus pontos no Lixo Zero.",
      },
    ],
  }),
  component: Painel,
});

const statusBadge = {
  pendente: { label: "Pendente", className: "bg-warning text-warning-foreground" },
  aprovada: { label: "Aprovada", className: "bg-success text-success-foreground" },
  rejeitada: { label: "Rejeitada", className: "bg-destructive text-destructive-foreground" },
} as const;

function Painel() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [materialId, setMaterialId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salaEscolhida, setSalaEscolhida] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<string | null>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const checarFoto = useServerFn(verificarFoto);

  const lerComoDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Não foi possível ler a foto."));
      reader.readAsDataURL(file);
    });

  const escolherFoto = (file: File | null) => {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFoto(file);
    setFotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const salas = useQuery({
    queryKey: ["salas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("salas").select("id, nome, turno").order("nome");
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

  const coletas = useQuery({
    queryKey: ["minhas-coletas", me?.userId],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coletas")
        .select(
          "id, quantidade, pontos, status, observacao, created_at, foto_path, materiais(nome, unidade)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const definirSala = useMutation({
    mutationFn: async (salaId: string) => {
      const { error } = await supabase.from("profiles").update({ sala_id: salaId }).eq("id", me!.userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sala definida!");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: () => toast.error("Não foi possível salvar a sala."),
  });


  const registrar = useMutation({
    mutationFn: async () => {
      const qtd = Number(quantidade.replace(",", "."));
      if (!materialId) throw new Error("Escolha o material");
      if (!Number.isFinite(qtd) || qtd <= 0) throw new Error("Informe uma quantidade válida");
      if (!me?.salaId) throw new Error("Defina a sua sala antes de registrar");
      const { error } = await supabase.from("coletas").insert({
        user_id: me.userId,
        sala_id: me.salaId,
        material_id: materialId,
        quantidade: qtd,
        observacao: observacao.trim() ? observacao.trim().slice(0, 300) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coleta registrada! Aguarde a aprovação da coordenação.");
      setQuantidade("");
      setObservacao("");
      queryClient.invalidateQueries({ queryKey: ["minhas-coletas"] });
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível registrar."),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coletas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coleta removida.");
      queryClient.invalidateQueries({ queryKey: ["minhas-coletas"] });
    },
    onError: () => toast.error("Somente a coordenação pode remover registros."),
  });

  const materialSelecionado = materiais.data?.find((m) => m.id === materialId);
  const pontosPrevistos = materialSelecionado
    ? Math.round(Number(materialSelecionado.pontos_por_unidade) * Number(quantidade.replace(",", ".") || 0) * 100) / 100
    : 0;

  const aprovados = (coletas.data ?? [])
    .filter((c) => c.status === "aprovada")
    .reduce((acc, c) => acc + Number(c.pontos), 0);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold">Olá, {me?.nome}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {me?.salaNome ? `Sala ${me.salaNome}` : "Você ainda não escolheu sua sala"} ·{" "}
          {aprovados.toLocaleString("pt-BR")} pontos aprovados por você
        </p>

        {!me?.hasAnyAdmin ? (
          <Card className="mt-6 border-accent/60 bg-accent/10">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">Nenhum administrador definido</p>
                <p className="text-sm text-muted-foreground">
                  A coordenação cria o acesso de administrador em "Acesso da coordenação" usando o
                  código de administrador.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link to="/acesso-admin">
                  <ShieldPlus className="mr-2 size-4" /> Acesso da coordenação
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!me?.salaId ? (
          <Card className="mt-6 shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Escolha a sua sala</CardTitle>
              <CardDescription>É necessário para registrar coletas.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Select value={salaEscolhida} onValueChange={setSalaEscolhida}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Selecione a sala" />
                </SelectTrigger>
                <SelectContent>
                  {salas.data?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome} — {s.turno}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => definirSala.mutate(salaEscolhida)}
                disabled={!salaEscolhida || definirSala.isPending}
              >
                Salvar sala
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Registrar nova coleta</CardTitle>
              <CardDescription>A coordenação confere antes de valer pontos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Material</Label>
                <Select value={materialId} onValueChange={setMaterialId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materiais.data?.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome} ({Number(m.pontos_por_unidade)} pts/{m.unidade})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qtd">
                  Quantidade {materialSelecionado ? `(${materialSelecionado.unidade})` : ""}
                </Label>
                <Input
                  id="qtd"
                  inputMode="decimal"
                  placeholder="Ex: 2,5"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="obs">Observação (opcional)</Label>
                <Input
                  id="obs"
                  maxLength={300}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>
              <div className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                Pontos previstos: <strong>{pontosPrevistos.toLocaleString("pt-BR")}</strong>
              </div>
              <Button
                className="w-full"
                onClick={() => registrar.mutate()}
                disabled={registrar.isPending || !me?.salaId}
              >
                {registrar.isPending ? "Registrando..." : "Registrar coleta"}
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Histórico</CardTitle>
              <CardDescription>Suas coletas registradas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {coletas.data?.length ? (
                coletas.data.map((c) => {
                  const badge = statusBadge[c.status];
                  const material = c.materiais as { nome: string; unidade: string } | null;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {material?.nome} — {Number(c.quantidade)} {material?.unidade}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("pt-BR")} ·{" "}
                          {Number(c.pontos).toLocaleString("pt-BR")} pts
                        </p>
                      </div>
                      <Badge className={badge.className}>
                        {c.status === "pendente" ? (
                          <Clock className="mr-1 size-3" />
                        ) : c.status === "aprovada" ? (
                          <CheckCircle2 className="mr-1 size-3" />
                        ) : (
                          <XCircle className="mr-1 size-3" />
                        )}
                        {badge.label}
                      </Badge>
                      {me?.isAdmin ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => excluir.mutate(c.id)}
                          aria-label="Excluir"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="py-6 text-sm text-muted-foreground">
                  Você ainda não registrou coletas.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
