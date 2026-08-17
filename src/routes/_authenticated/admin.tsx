import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Plus, Save, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Lixo Zero" },
      {
        name: "description",
        content:
          "Aprove coletas, ajuste a pontuação dos materiais e gerencie salas e usuários do Lixo Zero.",
      },
      { property: "og:title", content: "Administração — Lixo Zero" },
      {
        property: "og:description",
        content: "Painel de gestão das coletas, salas, materiais e usuários.",
      },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { data: me, isLoading } = useMe();
  const queryClient = useQueryClient();
  const invalidarTudo = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        ["coletas-admin", "ranking", "salas", "materiais", "usuarios", "minhas-coletas"].includes(
          String(q.queryKey[0]),
        ),
    });

  const [codigoNovo, setCodigoNovo] = useState("");
  const [novaSala, setNovaSala] = useState({ nome: "", turno: "Manhã" });
  const [novoMaterial, setNovoMaterial] = useState({ nome: "", unidade: "kg", pontos: "1" });

  const coletas = useQuery({
    queryKey: ["coletas-admin"],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coletas")
        .select(
          "id, quantidade, pontos, status, observacao, created_at, salas(nome), materiais(nome, unidade), profiles(nome)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const salas = useQuery({
    queryKey: ["salas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("salas").select("id, nome, turno").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const materiais = useQuery({
    queryKey: ["materiais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais")
        .select("id, nome, unidade, pontos_por_unidade, ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const usuarios = useQuery({
    queryKey: ["usuarios"],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const [{ data: perfis, error }, { data: papeis }] = await Promise.all([
        supabase.from("profiles").select("id, nome, ra, sala_id, salas(nome)").order("nome"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      return (perfis ?? []).map((p) => ({
        ...p,
        isAdmin: (papeis ?? []).some((r) => r.user_id === p.id && r.role === "admin"),
      }));
    },
  });

  const codigoAdmin = useQuery({
    queryKey: ["admin-codigo"],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_codigo");
      if (error) throw error;
      return data ?? "";
    },
  });

  const salvarCodigo = useMutation({
    mutationFn: async (novo: string) => {
      const { data, error } = await supabase.rpc("set_admin_codigo", { _codigo: novo.trim() });
      if (error) throw error;
      if (!data) throw new Error("Use um código com no mínimo 6 caracteres");
      return data;
    },
    onSuccess: () => {
      toast.success("Código de administrador atualizado.");
      queryClient.invalidateQueries({ queryKey: ["admin-codigo"] });
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível salvar o código."),
  });

  const avaliar = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "aprovada" | "rejeitada" }) => {
      const { error } = await supabase.from("coletas").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coleta atualizada.");
      invalidarTudo();
    },
    onError: () => toast.error("Não foi possível atualizar a coleta."),
  });

  const removerColeta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coletas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coleta removida.");
      invalidarTudo();
    },
    onError: () => toast.error("Não foi possível remover."),
  });

  const criarSala = useMutation({
    mutationFn: async () => {
      if (!novaSala.nome.trim()) throw new Error("Informe o nome da sala");
      const { error } = await supabase
        .from("salas")
        .insert({ nome: novaSala.nome.trim().slice(0, 60), turno: novaSala.turno });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sala criada.");
      setNovaSala({ nome: "", turno: "Manhã" });
      invalidarTudo();
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível criar a sala."),
  });

  const removerSala = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("salas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sala removida.");
      invalidarTudo();
    },
    onError: () => toast.error("Não foi possível remover a sala."),
  });

  const criarMaterial = useMutation({
    mutationFn: async () => {
      const pontos = Number(novoMaterial.pontos.replace(",", "."));
      if (!novoMaterial.nome.trim()) throw new Error("Informe o nome do material");
      if (!Number.isFinite(pontos) || pontos < 0) throw new Error("Pontuação inválida");
      const { error } = await supabase.from("materiais").insert({
        nome: novoMaterial.nome.trim().slice(0, 60),
        unidade: novoMaterial.unidade.trim().slice(0, 10) || "kg",
        pontos_por_unidade: pontos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material criado.");
      setNovoMaterial({ nome: "", unidade: "kg", pontos: "1" });
      invalidarTudo();
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível criar o material."),
  });

  const atualizarMaterial = useMutation({
    mutationFn: async (payload: {
      id: string;
      pontos_por_unidade?: number;
      unidade?: string;
      ativo?: boolean;
    }) => {
      const { id, ...campos } = payload;
      const { error } = await supabase.from("materiais").update(campos).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material atualizado.");
      invalidarTudo();
    },
    onError: () => toast.error("Não foi possível atualizar."),
  });

  const atualizarUsuario = useMutation({
    mutationFn: async ({ id, salaId }: { id: string; salaId: string }) => {
      const { error } = await supabase.from("profiles").update({ sala_id: salaId }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sala do usuário atualizada.");
      invalidarTudo();
    },
    onError: () => toast.error("Não foi possível atualizar o usuário."),
  });

  const alternarAdmin = useMutation({
    mutationFn: async ({ id, tornar }: { id: string; tornar: boolean }) => {
      if (tornar) {
        const { error } = await supabase.from("user_roles").insert({ user_id: id, role: "admin" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", id)
          .eq("role", "admin");
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Permissões atualizadas.");
      invalidarTudo();
    },
    onError: () => toast.error("Não foi possível alterar as permissões."),
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-muted-foreground">
          Carregando...
        </div>
      </AppShell>
    );
  }

  if (!me?.isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta área é exclusiva da coordenação. Fale com um administrador.
          </p>
          <Button asChild className="mt-6">
            <Link to="/painel">Ir para minhas coletas</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const pendentes = (coletas.data ?? []).filter((c) => c.status === "pendente");

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary" />
          <h1 className="text-3xl font-bold">Administração</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {pendentes.length} coleta(s) aguardando aprovação.
        </p>

        <Tabs defaultValue="coletas" className="mt-6">
          <TabsList>
            <TabsTrigger value="coletas">Coletas</TabsTrigger>
            <TabsTrigger value="salas">Salas</TabsTrigger>
            <TabsTrigger value="materiais">Materiais</TabsTrigger>
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          </TabsList>

          <TabsContent value="coletas" className="pt-4">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-base">Registros das salas</CardTitle>
                <CardDescription>Aprove ou rejeite cada coleta registrada.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {coletas.data?.length ? (
                  coletas.data.map((c) => {
                    const material = c.materiais as { nome: string; unidade: string } | null;
                    const sala = c.salas as { nome: string } | null;
                    const aluno = c.profiles as { nome: string } | null;
                    return (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 px-3 py-2"
                      >
                        <div className="min-w-[200px] flex-1">
                          <p className="text-sm font-medium">
                            {sala?.nome} · {material?.nome} — {Number(c.quantidade)}{" "}
                            {material?.unidade}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {aluno?.nome ?? "Aluno"} ·{" "}
                            {new Date(c.created_at).toLocaleString("pt-BR")} ·{" "}
                            {Number(c.pontos).toLocaleString("pt-BR")} pts
                            {c.observacao ? ` · ${c.observacao}` : ""}
                          </p>
                        </div>
                        <Badge
                          className={
                            c.status === "aprovada"
                              ? "bg-success text-success-foreground"
                              : c.status === "rejeitada"
                                ? "bg-destructive text-destructive-foreground"
                                : "bg-warning text-warning-foreground"
                          }
                        >
                          {c.status}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => avaliar.mutate({ id: c.id, status: "aprovada" })}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => avaliar.mutate({ id: c.id, status: "rejeitada" })}
                          >
                            <XCircle className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removerColeta.mutate(c.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-6 text-sm text-muted-foreground">Nenhuma coleta registrada.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="salas" className="pt-4">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-base">Salas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sala-nome">Nome</Label>
                    <Input
                      id="sala-nome"
                      className="w-40"
                      placeholder="Ex: 7º B"
                      value={novaSala.nome}
                      onChange={(e) => setNovaSala({ ...novaSala, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Turno</Label>
                    <Select
                      value={novaSala.turno}
                      onValueChange={(v) => setNovaSala({ ...novaSala, turno: v })}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Manhã", "Tarde", "Noite", "Integral"].map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => criarSala.mutate()} disabled={criarSala.isPending}>
                    <Plus className="mr-2 size-4" /> Adicionar
                  </Button>
                </div>

                <div className="space-y-2">
                  {salas.data?.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2"
                    >
                      <span className="text-sm">
                        {s.nome} <span className="text-muted-foreground">· {s.turno}</span>
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removerSala.mutate(s.id)}
                        aria-label="Remover sala"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="materiais" className="pt-4">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-base">Materiais e pontuação</CardTitle>
                <CardDescription>
                  Defina quantos pontos cada unidade de material vale.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="mat-nome">Material</Label>
                    <Input
                      id="mat-nome"
                      className="w-44"
                      value={novoMaterial.nome}
                      onChange={(e) => setNovoMaterial({ ...novoMaterial, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mat-un">Unidade</Label>
                    <Input
                      id="mat-un"
                      className="w-24"
                      value={novoMaterial.unidade}
                      onChange={(e) => setNovoMaterial({ ...novoMaterial, unidade: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mat-pts">Pontos/unidade</Label>
                    <Input
                      id="mat-pts"
                      className="w-32"
                      inputMode="decimal"
                      value={novoMaterial.pontos}
                      onChange={(e) => setNovoMaterial({ ...novoMaterial, pontos: e.target.value })}
                    />
                  </div>
                  <Button onClick={() => criarMaterial.mutate()} disabled={criarMaterial.isPending}>
                    <Plus className="mr-2 size-4" /> Adicionar
                  </Button>
                </div>

                <div className="space-y-2">
                  {materiais.data?.map((m) => (
                    <MaterialRow
                      key={m.id}
                      material={m}
                      onSave={(pontos, unidade) =>
                        atualizarMaterial.mutate({ id: m.id, pontos_por_unidade: pontos, unidade })
                      }
                      onToggle={(ativo) => atualizarMaterial.mutate({ id: m.id, ativo })}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usuarios" className="pt-4">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-base">Usuários</CardTitle>
                <CardDescription>Ajuste a sala e as permissões de cada pessoa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {usuarios.data?.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 px-3 py-2"
                  >
                    <div className="min-w-[160px] flex-1">
                      <p className="text-sm font-medium">{u.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {(u.salas as { nome: string } | null)?.nome ?? "Sem sala"}
                      </p>
                    </div>
                    <Select
                      value={u.sala_id ?? ""}
                      onValueChange={(v) => atualizarUsuario.mutate({ id: u.id, salaId: v })}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder="Definir sala" />
                      </SelectTrigger>
                      <SelectContent>
                        {salas.data?.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nome} — {s.turno}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`adm-${u.id}`} className="text-xs">
                        Admin
                      </Label>
                      <Switch
                        id={`adm-${u.id}`}
                        checked={u.isAdmin}
                        disabled={u.id === me.userId}
                        onCheckedChange={(v) => alternarAdmin.mutate({ id: u.id, tornar: v })}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function MaterialRow({
  material,
  onSave,
  onToggle,
}: {
  material: { id: string; nome: string; unidade: string; pontos_por_unidade: number; ativo: boolean };
  onSave: (pontos: number, unidade: string) => void;
  onToggle: (ativo: boolean) => void;
}) {
  const [pontos, setPontos] = useState(String(material.pontos_por_unidade));
  const [unidade, setUnidade] = useState(material.unidade);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 px-3 py-2">
      <span className="min-w-[140px] flex-1 text-sm font-medium">{material.nome}</span>
      <Input
        className="w-20"
        value={unidade}
        onChange={(e) => setUnidade(e.target.value)}
        aria-label={`Unidade de ${material.nome}`}
      />
      <Input
        className="w-24"
        inputMode="decimal"
        value={pontos}
        onChange={(e) => setPontos(e.target.value)}
        aria-label={`Pontos de ${material.nome}`}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => onSave(Number(pontos.replace(",", ".")) || 0, unidade.trim() || "kg")}
      >
        <Save className="mr-1 size-4" /> Salvar
      </Button>
      <div className="flex items-center gap-2">
        <Label className="text-xs">Ativo</Label>
        <Switch checked={material.ativo} onCheckedChange={onToggle} />
      </div>
    </div>
  );
}
