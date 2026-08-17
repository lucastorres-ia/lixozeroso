import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Leaf, ShieldCheck } from "lucide-react";
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
import { normalizeRa, raToEmail } from "@/lib/ra";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar com R.A. — Lixo Zero" },
      {
        name: "description",
        content:
          "Alunos entram no Lixo Zero com o R.A. e a senha para registrar as coletas da sua sala.",
      },
      { property: "og:title", content: "Entrar com R.A. — Lixo Zero" },
      {
        property: "og:description",
        content: "Acesse com seu R.A. e senha e registre as coletas da sua sala.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const raField = z
  .string()
  .trim()
  .min(4, { message: "Informe seu R.A. (mínimo 4 caracteres)" })
  .max(30, { message: "R.A. muito longo" })
  .refine((v) => normalizeRa(v).length >= 4, { message: "R.A. inválido" });

const loginSchema = z.object({
  ra: raField,
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

  const [loginData, setLoginData] = useState({ ra: "", senha: "" });
  const [signupData, setSignupData] = useState({ nome: "", ra: "", senha: "", salaId: "" });

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
      email: raToEmail(parsed.data.ra),
      password: parsed.data.senha,
    });
    setLoading(false);
    if (error) {
      toast.error("R.A. ou senha incorretos.");
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
    const ra = normalizeRa(parsed.data.ra);
    const { data, error } = await supabase.auth.signUp({
      email: raToEmail(ra),
      password: parsed.data.senha,
      options: {
        data: { nome: parsed.data.nome, sala_id: parsed.data.salaId, ra },
      },
    });
    setLoading(false);
    if (error) {
      const m = error.message.toLowerCase();
      let msg = `Não foi possível criar a conta: ${error.message}`;
      if (m.includes("already") || m.includes("registered")) {
        msg = "Este R.A. já tem conta. Use a aba Entrar.";
      } else if (m.includes("weak") || m.includes("pwned")) {
        msg = "Essa senha é muito fraca. Escolha outra com letras e números.";
      } else if (m.includes("password")) {
        msg = "A senha deve ter no mínimo 6 caracteres.";
      } else if (m.includes("rate") || m.includes("seconds")) {
        msg = "Muitas tentativas. Aguarde alguns instantes e tente de novo.";
      }
      toast.error(msg);
      return;
    }
    if (!data.session) {
      toast.success("Conta criada! Agora entre com seu R.A. e senha.");
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
          <h1 className="mt-4 text-2xl font-bold">Acesso do aluno</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre com o seu R.A. e senha para registrar as coletas da sua sala.
          </p>
        </div>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sua conta</CardTitle>
            <CardDescription>Use o R.A. da sua matrícula escolar.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="entrar">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="entrar">Entrar</TabsTrigger>
                <TabsTrigger value="cadastrar">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="entrar">
                <form onSubmit={handleLogin} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-ra">R.A. do aluno</Label>
                    <Input
                      id="login-ra"
                      inputMode="numeric"
                      autoComplete="username"
                      placeholder="Ex.: 0012345678"
                      value={loginData.ra}
                      onChange={(e) => setLoginData({ ...loginData, ra: e.target.value })}
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
                    <Label htmlFor="signup-ra">R.A. do aluno</Label>
                    <Input
                      id="signup-ra"
                      inputMode="numeric"
                      placeholder="Ex.: 0012345678"
                      value={signupData.ra}
                      onChange={(e) => setSignupData({ ...signupData, ra: e.target.value })}
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
                    <Label htmlFor="signup-senha">Senha</Label>
                    <Input
                      id="signup-senha"
                      type="password"
                      autoComplete="new-password"
                      value={signupData.senha}
                      onChange={(e) => setSignupData({ ...signupData, senha: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Guarde bem sua senha: sem e-mail cadastrado, só a coordenação pode redefini-la.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Criando conta..." : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Button asChild variant="ghost" size="sm" className="mt-4 w-full">
          <Link to="/acesso-admin">
            <ShieldCheck className="size-4" /> Sou da coordenação (acesso admin)
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
