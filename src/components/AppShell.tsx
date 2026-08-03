import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Leaf, LogOut, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { data: me } = useMe();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { to: "/", label: "Ranking" },
    ...(me ? [{ to: "/painel", label: "Minhas coletas" }] : []),
    ...(me?.isAdmin ? [{ to: "/admin", label: "Administração" }] : []),
  ];

  return (
    <>
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground",
            pathname === item.to && "bg-secondary text-secondary-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-hero-gradient text-primary-foreground">
              <Leaf className="size-5" />
            </span>
            <span className="font-display text-lg font-semibold leading-none">
              EcoColeta
              <span className="block text-[11px] font-normal text-muted-foreground">
                Registro escolar de coletas
              </span>
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            <NavLinks />
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-3">
            {me ? (
              <>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium leading-tight">{me.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {me.isAdmin ? "Administrador" : (me.salaNome ?? "Sem sala")}
                  </p>
                </div>
                <Button variant="outline" size="icon" onClick={handleSignOut} aria-label="Sair">
                  <LogOut className="size-4" />
                </Button>
              </>
            ) : (
              <Button asChild size="sm">
                <Link to="/auth">Entrar</Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              <Menu className="size-4" />
            </Button>
          </div>
        </div>
        {open ? (
          <nav className="flex flex-col gap-1 border-t border-border/70 px-4 py-3 md:hidden">
            <NavLinks onNavigate={() => setOpen(false)} />
          </nav>
        ) : null}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/70 py-6">
        <p className="mx-auto max-w-6xl px-4 text-xs text-muted-foreground">
          EcoColeta — cada quilo registrado vira ponto para a sua sala.
        </p>
      </footer>
    </div>
  );
}
