import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { adminUserToEmail, normalizeRa } from "@/lib/ra";

export const Route = createFileRoute("/acesso-admin")({
  head: () => ({
    meta: [
      { title: "Acesso da coordenação — Lixo Zero" },
      {
        name: "description",
        content:
          "Área restrita: entrada da coordenação para aprovar coletas, gerenciar salas, materiais e pontuação.",
      },
      { property: "og:title", content: "Acesso da coordenação — Lixo Zero" },
      {
        property: "og:description",
        content: "Entrada exclusiva dos administradores do Lixo Zero.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AcessoAdmin,
});

const schema = z.object({
  usuario: z
    .string()
    .trim()
    .min(3, { message: "Informe o usuário do administrador" })
    .max(30)
    .refine((v) => normalizeRa(v).length >= 3, { message: "Usuário inválido" }),
  senha: z.string().min(6, { message: "A senha deve ter no mínimo 6 caracteres" }).max(72),
});

const criarSchema = schema.extend({
  nome: z.string().trim().min(2, { message: "Informe seu nome" }).max(80),
  codigo: z.string().trim().min(6, { message: "Informe o código de administrador" }).max(60),
});

function AcessoAdmin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [login, setLogin] = useState({ usuario: "", senha: "" });
  const [criar, setCriar] = useState({ nome: "", usuario: "", senha: "", codigo: "" });

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(login);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: adminUserToEmail(parsed.data.usuario),
      password: parsed.data.senha,
    });
    setLoading(false);
    if (error) return toast.error("Usuário ou senha de administrador incorretos.");
    await queryClient.invalidateQueries();
    navigate({ to: "/admin", replace: true });
  }

  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    const parsed = criarSchema.safeParse(criar);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message);
    setLoading(true);
    const email = adminUserToEmail(parsed.data.usuario);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: parsed.data.senha,
      options: { data: { nome: parsed.data.nome } },
    });

    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("already") || m.includes("registered")) {
        // conta já existe: tenta entrar e promover com o código
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password: parsed.data.senha,
        });
        if (loginError) {
          setLoading(false);
          return toast.error("Este usuário já existe e a senha não confere.");
        }
      } else {
        setLoading(false);
        return toast.error(`Não foi possível criar o acesso: ${error.message}`);
      }
    } else if (!data.session) {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password: parsed.data.senha,
      });
      if (loginError) {
        setLoading(false);
        return toast.error("Acesso criado, mas não foi possível entrar. Tente na aba Entrar.");
      }
    }

    const { data: ok, error: rpcError } = await supabase.rpc("claim_admin_com_codigo", {
      _codigo: parsed.data.codigo,
    });
    setLoading(false);
    if (rpcError || !ok) {
      await supabase.auth.signOut();
      return toast.error("Código de administrador inválido.");
    }
    await queryClient.invalidateQueries();
    toast.success("Acesso de administrador liberado!");
    navigate({ to: "/admin", replace: true });
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-md flex-col px-4 py-12">
        <div className="mb-6 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-hero-gradient text-primary-foreground">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl font-bold">Acesso da coordenação</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Área restrita para administradores do Lixo Zero.
          </p>
        </div>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Administração</CardTitle>
            <CardDescription>
              Para criar um novo administrador é necessário o código de administrador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="entrar">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="entrar">Entrar</TabsTrigger>
                <TabsTrigger value="criar">Novo admin</TabsTrigger>
              </TabsList>

              <TabsContent value="entrar">
                <form onSubmit={entrar} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="adm-usuario">Usuário</Label>
                    <Input
                      id="adm-usuario"
                      autoComplete="username"
                      value={login.usuario}
                      onChange={(e) => setLogin({ ...login, usuario: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adm-senha">Senha</Label>
                    <Input
                      id="adm-senha"
                      type="password"
                      autoComplete="current-password"
                      value={login.senha}
                      onChange={(e) => setLogin({ ...login, senha: e.target.value })}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar como administrador"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="criar">
                <form onSubmit={criarConta} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="adm-nome">Nome</Label>
                    <Input
                      id="adm-nome"
                      value={criar.nome}
                      onChange={(e) => setCriar({ ...criar, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adm-novo-usuario">Usuário</Label>
                    <Input
                      id="adm-novo-usuario"
                      placeholder="Ex.: coordenacao"
                      value={criar.usuario}
                      onChange={(e) => setCriar({ ...criar, usuario: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adm-nova-senha">Senha</Label>
                    <Input
                      id="adm-nova-senha"
                      type="password"
                      autoComplete="new-password"
                      value={criar.senha}
                      onChange={(e) => setCriar({ ...criar, senha: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adm-codigo">Código de administrador</Label>
                    <Input
                      id="adm-codigo"
                      type="password"
                      value={criar.codigo}
                      onChange={(e) => setCriar({ ...criar, codigo: e.target.value })}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Liberando acesso..." : "Criar administrador"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Button asChild variant="ghost" size="sm" className="mt-4 w-full">
          <Link to="/auth">Sou aluno, entrar com R.A.</Link>
        </Button>
      </div>
    </AppShell>
  );
}
