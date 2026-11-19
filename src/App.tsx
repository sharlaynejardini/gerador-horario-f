import { useEffect, useState, type FormEvent } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { isAxiosError } from "axios";
import { ArrowRight, CalendarDays, LoaderCircle, LogOut, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { obterPerfil, supabase, type Perfil } from "@/lib/services";

const papeis = { ADMIN: "Administrador", GESTOR: "Gestor", VISUALIZADOR: "Visualizador" };

export function App() {
  return supabase ? <Workspace client={supabase} /> : (
    <Layout>
      <h1>Configuração pendente</h1>
      <p className="mt-3 text-muted-foreground">
        Preencha o arquivo .env do frontend com a URL e a chave pública do Supabase e o endereço da API.
      </p>
    </Layout>
  );
}

function Workspace({ client }: { client: SupabaseClient }) {
  const [session, setSession] = useState<Session | null>();

  useEffect(() => {
    const { data: { subscription } } = client.auth.onAuthStateChange((_, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, [client]);

  return (
    <Layout>
      {session === undefined ? <Loading>Verificando sessão…</Loading>
        : session ? <Profile key={session.user.id} client={client} session={session} />
        : <Login client={client} />}
    </Layout>
  );
}

function Login({ client }: { client: SupabaseClient }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setPending(true);
    try {
      const { error } = await client.auth.signInWithPassword({
        email: String(form.get("email")).trim(),
        password: String(form.get("senha")),
      });
      if (error) {
        setError(error.code === "email_not_confirmed" ? "Confirme seu e-mail para entrar."
          : error.code === "invalid_credentials" ? "E-mail ou senha inválidos."
          : "Não foi possível entrar. Tente novamente.");
      }
    } catch {
      setError("O serviço de autenticação está indisponível. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1>Acesse sua conta</h1>
      <p className="mt-3 text-muted-foreground">Entre com seu e-mail institucional para acessar suas escolas.</p>
      <form onSubmit={entrar} className="mt-8 grid gap-5">
        <div className="grid gap-2">
          <label htmlFor="email" className="text-sm font-semibold">E-mail</label>
          <Input id="email" name="email" type="email" autoComplete="username" placeholder="nome@escola.edu.br" required />
        </div>
        <div className="grid gap-2">
          <label htmlFor="senha" className="text-sm font-semibold">Senha</label>
          <Input id="senha" name="senha" type="password" autoComplete="current-password" required />
        </div>
        {error && <Feedback>{error}</Feedback>}
        <Button type="submit" disabled={pending} className="mt-1 h-12">
          {pending ? <><LoaderCircle className="animate-spin" aria-hidden="true" /> Entrando…</>
            : <>Entrar <ArrowRight aria-hidden="true" /></>}
        </Button>
      </form>
    </>
  );
}

function Profile({ client, session }: { client: SupabaseClient; session: Session }) {
  const [profile, setProfile] = useState<Perfil>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const token = session.access_token;

  useEffect(() => {
    const controller = new AbortController();
    obterPerfil(token, controller.signal).then((nextProfile) => {
      if (controller.signal.aborted) return;
      setProfile(nextProfile);
      setError("");
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setError(isAxiosError(error) && error.response?.status === 401
        ? "Sua sessão foi recusada pela API. Saia e entre novamente."
        : "Não foi possível carregar suas escolas. Tente novamente.");
    });
    return () => controller.abort();
  }, [token, attempt]);

  async function sair() {
    setLeaving(true);
    setSignOutError("");
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) setSignOutError("Não foi possível sair. Tente novamente.");
    } catch {
      setSignOutError("Não foi possível sair. Tente novamente.");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <>
      <h1>Minhas escolas</h1>
      <p className="mt-3 break-words text-muted-foreground">{profile?.nome || session.user.email || "Conta autenticada"}</p>
      <div className="mt-7">
        {error ? <>
          <Feedback>{error}</Feedback>
          <Button variant="outline" className="mt-3" onClick={() => {
            setError("");
            setAttempt((previous) => previous + 1);
          }}>Tentar novamente</Button>
        </> : profile ? (
          profile.escolas.length ? (
            <ul className="grid max-h-84 gap-3 overflow-y-auto pr-1">
              {profile.escolas.map(({ escola, papel }) => (
                <li key={escola.id} className="flex items-center gap-3 rounded-xl border border-input p-4">
                  <School className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="break-words font-semibold">{escola.nome}</p>
                    <p className="text-sm text-muted-foreground">{papeis[papel]}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-muted p-4 text-sm">Sua conta ainda não está vinculada a uma escola. Solicite o vínculo ao administrador.</p>
          )
        ) : <Loading>Carregando suas escolas…</Loading>}
      </div>
      {signOutError && <div className="mt-4"><Feedback>{signOutError}</Feedback></div>}
      <Button variant="outline" className="mt-6" disabled={leaving} onClick={sair}>
        <LogOut aria-hidden="true" /> {leaving ? "Saindo…" : "Sair"}
      </Button>
    </>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="page">
      <aside className="identity">
        <div className="brand"><CalendarDays aria-hidden="true" /> Gerador de horários</div>
        <div className="identity-content">
          <p className="identity-title">Horários<br className="hidden lg:block" /> escolares</p>
          <div className="schedule-art" aria-hidden="true">
            <div className="schedule-axis" />
            <div className="schedule-week">
              {["Seg", "Ter", "Qua", "Qui", "Sex"].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="schedule-times"><span>07h</span><span>08h</span><span>09h</span><span>10h</span></div>
            <div className="schedule-cells">
              {["1", "", "2", "1", "", "3", "2", "", "2", "3", "", "1", "3", "", "1", "2", "", "1", "3", "2"].map((value, index) =>
                <span key={index} data-color={value} />,
              )}
            </div>
          </div>
        </div>
      </aside>
      <section className="workspace">{children}</section>
    </main>
  );
}

function Feedback({ children }: { children: string }) {
  return <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{children}</p>;
}

function Loading({ children }: { children: string }) {
  return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
    <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />{children}
  </p>;
}
