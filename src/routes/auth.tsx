import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Leaf } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Lixo Zero" },
      {
        name: "description",
        content: "Acesse sua conta ou cadastre-se escolhendo a sua sala para registrar coletas.",
      },
      { property: "og:title", content: "Entrar — Lixo Zero" },
      {
        property: "og:description",
        content: "Acesse sua conta Lixo Zero e registre as coletas da sua sala.",
      },
    ],
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255),
  senha: z.string().min(6, { message: "A senha deve ter no mínimo 6 caracteres" }).max(72),
});

const signupSchema = loginSchema.extend({
  nome: z.string().trim().min(2, { message: "Informe seu nome" }).max(80),
  salaId: z.string().uuid({ message: "Escolha a sua sala" }),
});

function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [loading, setLoading] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const [loginData, setLoginData] = useState({ email: "", senha: "" });
  const [signupData, setSignupData] = useState({ nome: "", email: "", senha: "", salaId: "" });

  const salas = useQuery({
    queryKey: ["salas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("salas").select("id, nome, turno").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (me) navigate({ to: "/painel", replace: true });
  }, [me, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse(loginData);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.senha,
    });
    setLoading(false);
    if (error) {
      const m = error.message.toLowerCase();
      toast.error(
        m.includes("not confirmed")
          ? "Confirme seu e-mail antes de entrar."
          : "E-mail ou senha incorretos.",
      );
      return;
    }
    await queryClient.invalidateQueries();
    navigate({ to: "/painel", replace: true });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse(signupData);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.senha,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nome: parsed.data.nome, sala_id: parsed.data.salaId },
      },
    });
    setLoading(false);
    if (error) {
      const m = error.message.toLowerCase();
      let msg = `Não foi possível criar a conta: ${error.message}`;
      if (m.includes("already") || m.includes("registered")) {
        msg = "Este e-mail já está cadastrado. Use a aba Entrar.";
      } else if (m.includes("weak") || m.includes("pwned")) {
        msg = "Essa senha é muito fraca ou comum. Escolha outra com letras e números.";
      } else if (m.includes("password")) {
        msg = "A senha deve ter no mínimo 6 caracteres.";
      } else if (m.includes("invalid") && m.includes("email")) {
        msg = "E-mail inválido. Confira o endereço digitado.";
      } else if (m.includes("rate") || m.includes("seconds")) {
        msg = "Muitas tentativas. Aguarde alguns instantes e tente de novo.";
      }
      toast.error(msg);
      return;
    }
    if (!data.session) {
      setAviso("Cadastro criado! Confirme o e-mail que enviamos para poder entrar.");
      toast.success("Confira seu e-mail para confirmar o cadastro.");
      return;
    }
    await queryClient.invalidateQueries();
    navigate({ to: "/painel", replace: true });
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-md flex-col px-4 py-12">
        <div className="mb-6 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-hero-gradient text-primary-foreground">
            <Leaf className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl font-bold">Acesso ao Lixo Zero</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre para registrar as coletas da sua sala.
          </p>
        </div>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sua conta</CardTitle>
            <CardDescription>Use o e-mail informado à coordenação.</CardDescription>
          </CardHeader>
          <CardContent>
            {aviso ? (
              <p className="mb-4 rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
                {aviso}
              </p>
            ) : null}
            <Tabs defaultValue="entrar">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="entrar">Entrar</TabsTrigger>
                <TabsTrigger value="cadastrar">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="entrar">
                <form onSubmit={handleLogin} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-mail</Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-senha">Senha</Label>
                    <Input
                      id="login-senha"
                      type="password"
                      autoComplete="current-password"
                      value={loginData.senha}
                      onChange={(e) => setLoginData({ ...loginData, senha: e.target.value })}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="cadastrar">
                <form onSubmit={handleSignup} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome completo</Label>
                    <Input
                      id="nome"
                      value={signupData.nome}
                      onChange={(e) => setSignupData({ ...signupData, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sala">Sua sala</Label>
                    <Select
                      value={signupData.salaId}
                      onValueChange={(v) => setSignupData({ ...signupData, salaId: v })}
                    >
                      <SelectTrigger id="sala">
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
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-mail</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-senha">Senha</Label>
                    <Input
                      id="signup-senha"
                      type="password"
                      autoComplete="new-password"
                      value={signupData.senha}
                      onChange={(e) => setSignupData({ ...signupData, senha: e.target.value })}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Criando conta..." : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
