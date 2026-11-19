import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { CalendarClock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { turnosDaEscola, type Periodo, type Turno } from "@/lib/services";

type Editor =
  | { tipo: "turno"; registro?: Turno }
  | { tipo: "periodo"; turnoId: string; registro?: Periodo };

type GrupoIntervalo = 1 | 2;
const posicoesDasAulas = [1, 2, 3, 4, 5];

export function Turnos({ escolaId, token, podeEditar }: { escolaId: string; token: string; podeEditar: boolean }) {
  const api = useMemo(() => turnosDaEscola(escolaId, token), [escolaId, token]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [turnoId, setTurnoId] = useState("");
  const [editor, setEditor] = useState<Editor>();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [erroConsulta, setErroConsulta] = useState("");
  const [erroEdicao, setErroEdicao] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [grupoFeedback, setGrupoFeedback] = useState<GrupoIntervalo>();
  const editorRef = useRef<HTMLFormElement>(null);
  const turno = turnos.find(({ id }) => turnoId === id) ?? turnos[0];

  useEffect(() => {
    if (!editor) return;
    editorRef.current?.scrollIntoView({ block: "nearest" });
    editorRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }, [editor]);

  useEffect(() => {
    const controller = new AbortController();
    api.listar(controller.signal).then((dados) => {
      if (controller.signal.aborted) return;
      setTurnos(dados);
      setErroConsulta("");
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setErroConsulta(mensagemApi(error));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [api, revisao]);

  function atualizar() {
    setLoading(true);
    setErroConsulta("");
    setRevisao((valor) => valor + 1);
  }

  function abrirEditor(novo: Editor) {
    setEditor(novo);
    setErroEdicao("");
    setMensagem("");
  }

  async function alterar(operacao: () => Promise<void>, sucesso: string, grupo?: GrupoIntervalo) {
    setPending(true);
    setGrupoFeedback(grupo);
    setErroEdicao("");
    setMensagem("");
    try {
      await operacao();
      setEditor(undefined);
      setMensagem(sucesso);
      atualizar();
    } catch (error) {
      setErroEdicao(mensagemApi(error));
    } finally {
      setPending(false);
    }
  }

  function salvarHorario(
    event: FormEvent<HTMLFormElement>,
    grupo: GrupoIntervalo,
    periodo?: Periodo,
  ) {
    event.preventDefault();
    if (!turno || !podeEditar || pending || loading || editor || erroConsulta) return;
    const dados = new FormData(event.currentTarget);
    void alterar(() => api.salvarPeriodo(turno.id, {
      ordem: periodo?.ordem ?? grupo,
      inicio: String(dados.get("inicio")),
      fim: String(dados.get("fim")),
      intervalo: true,
      grupoIntervalo: grupo,
    }, periodo?.id), `Horário do ${grupo}º intervalo salvo.`, grupo);
  }

  function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || pending || loading) return;
    const dados = new FormData(event.currentTarget);
    const { registro } = editor;
    if (editor.tipo === "turno") {
      void alterar(async () => {
        setTurnoId(await api.salvarTurno({
          nome: String(dados.get("nome")).trim(),
          seriesGrupo1: separarSeries(dados.get("seriesGrupo1")),
          seriesGrupo2: separarSeries(dados.get("seriesGrupo2")),
        }, registro?.id));
      }, registro ? "Turno atualizado." : "Turno cadastrado.");
    } else {
      const [tipo, grupo] = String(dados.get("tipoPeriodo")).split("-");
      const grupoIntervalo = Number(grupo);
      void alterar(() => api.salvarPeriodo(editor.turnoId, {
        ordem: tipo === "intervalo" ? grupoIntervalo : Number(dados.get("ordem")),
        inicio: String(dados.get("inicio")),
        fim: String(dados.get("fim")),
        intervalo: tipo === "intervalo",
        grupoIntervalo,
      }, registro?.id), registro ? "Período atualizado." : "Período cadastrado.");
    }
  }

  function excluir(turno: Turno, periodo?: Periodo) {
    const nome = periodo ? `${periodo.inicio} a ${periodo.fim}` : turno.nome;
    if (!window.confirm(`Excluir ${periodo ? "o período" : "o turno"} “${nome}”?`)) return;
    void alterar(() => api.excluir(turno.id, periodo?.id), periodo ? "Período excluído." : "Turno excluído.");
  }

  const inativo = pending || loading;

  return (
    <section aria-labelledby="titulo-turnos" className="min-w-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-turnos" className="text-xl font-bold tracking-tight">Turnos e períodos</h2>
        {podeEditar && <Button onClick={() => abrirEditor({ tipo: "turno" })} disabled={inativo || Boolean(erroConsulta)}>
          <Plus aria-hidden="true" /> Novo turno
        </Button>}
      </div>
      {!grupoFeedback && mensagem && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{mensagem}</p>}
      {!grupoFeedback && erroEdicao && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-900">{erroEdicao}</p>}
      {erroConsulta && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">
        <p role="alert">{erroConsulta}</p>
        <Button variant="outline" onClick={atualizar}>Tentar novamente</Button>
      </div>}
      {loading && <p role="status" className="mb-4 text-sm text-muted-foreground">Carregando turnos…</p>}
      {editor && <form
        key={editor.tipo + (editor.registro?.id ?? "novo")}
        ref={editorRef}
        onSubmit={salvar}
        className="mb-5 rounded-xl border border-input bg-background p-5"
      >
        <h3 className="mb-4 font-semibold">{editor.registro ? "Editar" : "Cadastrar"} {
          editor.tipo === "turno" ? "turno" : editor.registro?.intervalo ? "intervalo" : "aula"
        }</h3>
        <fieldset disabled={inativo} className="min-w-0">
          {editor.tipo === "turno" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold sm:col-span-2 sm:max-w-md">
                Nome do turno
                <Input name="nome" defaultValue={editor.registro?.nome} maxLength={100} required />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Séries do grupo de intervalo 1
                <Input name="seriesGrupo1" defaultValue={editor.registro?.seriesGrupo1?.join(", ")} placeholder="Ex. 1º ano, 2º ano" />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Séries do grupo de intervalo 2
                <Input name="seriesGrupo2" defaultValue={editor.registro?.seriesGrupo2?.join(", ")} placeholder="Ex. 3º ano, 4º ano, 5º ano" />
              </label>
              <p className="text-sm text-muted-foreground sm:col-span-2">Separe as séries por vírgulas. Cada série pertence a um único grupo.</p>
            </div>
          ) : (
            <CamposPeriodo registro={editor.registro} periodos={turno?.periodos ?? []} />
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit">{pending ? "Salvando…" : "Salvar"}</Button>
            <Button type="button" variant="outline" onClick={() => { setEditor(undefined); setErroEdicao(""); }}>Cancelar</Button>
          </div>
        </fieldset>
      </form>}
      {turnos.length > 0 && <>
        <label className="mb-4 grid max-w-md gap-2 text-sm font-semibold">
          Turno
          <select value={turno?.id} disabled={inativo || Boolean(editor)} onChange={(event) => {
            setTurnoId(event.currentTarget.value);
            setErroEdicao("");
            setMensagem("");
          }} className="h-11 w-full rounded-lg border border-input bg-background px-3">
            {turnos.map(({ id, nome }) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </label>
        <div className="rounded-xl border border-input bg-background">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-input p-4 sm:p-5">
            <div className="flex min-w-0 items-center gap-2">
              <CalendarClock className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <h3 className="break-words font-bold">{turno.nome}</h3>
            </div>
            {podeEditar && <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={inativo || Boolean(editor)} onClick={() => abrirEditor({ tipo: "turno", registro: turno })}>Editar turno</Button>
              <Button variant="outline" disabled={inativo || Boolean(editor)} onClick={() => excluir(turno)}>Excluir turno</Button>
              <Button disabled={inativo || Boolean(editor) || !haAulasDisponiveis(turno.periodos)} onClick={() => abrirEditor({
                tipo: "periodo", turnoId: turno.id,
              })}><Plus aria-hidden="true" /> Nova aula</Button>
            </div>}
          </div>
          <div key={turno.id} className="grid gap-4 border-b border-input px-4 py-4 md:grid-cols-2 sm:px-5">
            {([1, 2] as const).map((grupo) => {
              const series = grupo === 1 ? turno.seriesGrupo1 : turno.seriesGrupo2;
              const intervalo = turno.periodos.find((periodo) => periodo.intervalo && periodo.grupoIntervalo === grupo);
              return <HorarioIntervalo
                key={grupo}
                grupo={grupo}
                series={series}
                intervalo={intervalo}
                aulasCadastradas={posicoesDasAulas.length - posicoesDisponiveis(turno.periodos, grupo).length}
                podeEditar={podeEditar}
                desabilitado={inativo || Boolean(editor) || Boolean(erroConsulta)}
                onSubmit={(event) => salvarHorario(event, grupo, intervalo)}
                mensagem={grupoFeedback === grupo ? mensagem : ""}
                erro={grupoFeedback === grupo ? erroEdicao : ""}
              />;
            })}
          </div>
          {turno.periodos.length ? <ul className="divide-y divide-input">
            {turno.periodos.map((periodo) => <li key={periodo.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div>
                <p className="text-sm font-semibold">{!periodo.intervalo && `${periodo.ordem}. `}{rotuloPeriodo(periodo)}</p>
                <p className="text-sm tabular-nums text-muted-foreground">{periodo.inicio} a {periodo.fim}</p>
              </div>
              {podeEditar && <div className="flex gap-2">
                <Button variant="outline" aria-label={periodo.intervalo ? `Editar ${rotuloPeriodo(periodo)}` : `Editar aula da posição ${periodo.ordem}`} disabled={inativo || Boolean(editor)} onClick={() => abrirEditor({
                  tipo: "periodo", turnoId: turno.id, registro: periodo,
                })}>Editar</Button>
                <Button variant="outline" aria-label={`Excluir período ${periodo.ordem}, ${rotuloPeriodo(periodo)}`} disabled={inativo || Boolean(editor)} onClick={() => excluir(turno, periodo)}>Excluir</Button>
              </div>}
            </li>)}
          </ul> : <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">Este turno ainda não tem períodos.</p>}
        </div>
      </>}
      {!turno && !loading && !erroConsulta && <p className="rounded-xl border border-input bg-background p-5 text-sm text-muted-foreground">
        Esta escola ainda não tem turnos cadastrados.
      </p>}
    </section>
  );
}

function CamposPeriodo({ registro, periodos }: { registro?: Periodo; periodos: Periodo[] }) {
  const [tipo, setTipo] = useState(() => {
    if (registro) return tipoDoPeriodo(registro);
    const grupo = [0, 1, 2].find((grupo) => posicoesDisponiveis(periodos, grupo).length);
    return `aula-${grupo ?? 0}`;
  });
  const [posicao, setPosicao] = useState(registro?.ordem);
  const aula = tipo.startsWith("aula-");
  const grupo = Number(tipo.split("-")[1]);
  const livres = posicoesDisponiveis(periodos, grupo, registro?.id);
  const posicaoSelecionada = posicao !== undefined && livres.includes(posicao) ? posicao : (livres[0] ?? "");

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="grid gap-2 text-sm font-semibold">Início
        <Input name="inicio" type="time" defaultValue={registro?.inicio} required />
      </label>
      <label className="grid gap-2 text-sm font-semibold">Fim
        <Input name="fim" type="time" defaultValue={registro?.fim} required />
      </label>
      {aula && <label className="grid gap-2 text-sm font-semibold">Posição da aula
        <select name="ordem" value={posicaoSelecionada} onChange={(event) => setPosicao(Number(event.currentTarget.value))}
          className="h-11 w-full rounded-lg border border-input bg-background px-3" required>
          <option value="" disabled>Todas as posições deste grupo estão ocupadas</option>
          {posicoesDasAulas.map((ordem) => (
            <option key={ordem} value={ordem} disabled={!livres.includes(ordem)}>
              {ordem}ª aula{livres.includes(ordem) ? "" : " (ocupada)"}
            </option>
          ))}
        </select>
      </label>}
      <label className="grid gap-2 text-sm font-semibold sm:col-span-3 sm:max-w-md">
        Tipo de período
        <select name="tipoPeriodo" value={tipo} onChange={(event) => setTipo(event.currentTarget.value)} required
          className="h-11 w-full rounded-lg border border-input bg-background px-3">
          <option value="" disabled>Escolha o grupo deste intervalo</option>
          <option value="aula-0">Aula comum a todas as séries</option>
          <option value="aula-1">Aula do grupo 1</option>
          <option value="aula-2">Aula do grupo 2</option>
          {registro && <>
            <option value="intervalo-1">1º intervalo</option>
            <option value="intervalo-2">2º intervalo</option>
          </>}
        </select>
      </label>
    </div>
  );
}

function HorarioIntervalo({
  grupo, series, intervalo, aulasCadastradas, podeEditar, desabilitado, onSubmit, mensagem, erro,
}: {
  grupo: GrupoIntervalo;
  series: string[];
  intervalo?: Periodo;
  aulasCadastradas: number;
  podeEditar: boolean;
  desabilitado: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  mensagem: string;
  erro: string;
}) {
  const titulo = `${grupo}º intervalo`;
  const formKey = intervalo ? `${intervalo.id}-${intervalo.inicio}-${intervalo.fim}` : "novo";
  return (
    <section aria-labelledby={`intervalo-${grupo}`} className="min-w-0 rounded-xl border border-input p-4 text-sm">
      <h4 id={`intervalo-${grupo}`} className="font-bold">{titulo}</h4>
      <p className="mt-1 break-words text-muted-foreground">{series?.join(", ") || "Séries a definir"}</p>
      <p className="mt-1 text-muted-foreground">{aulasCadastradas} de {posicoesDasAulas.length} aulas cadastradas para este grupo</p>
      {podeEditar ? <form key={formKey} onSubmit={onSubmit} className="mt-4">
        <fieldset disabled={desabilitado} className="min-w-0">
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 font-semibold">Início
              <Input aria-label={`Início do ${titulo}`} name="inicio" type="time" defaultValue={intervalo?.inicio} required />
            </label>
            <label className="grid gap-1.5 font-semibold">Fim
              <Input aria-label={`Fim do ${titulo}`} name="fim" type="time" defaultValue={intervalo?.fim} required />
            </label>
          </div>
          <Button type="submit" variant="outline" className="mt-3" aria-label={`Salvar horário do ${titulo}`}>Salvar horário</Button>
        </fieldset>
      </form> : <p className="mt-2 tabular-nums">{intervalo ? `${intervalo.inicio} a ${intervalo.fim}` : "Horário a definir"}</p>}
      {mensagem && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-emerald-900">{mensagem}</p>}
      {erro && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-red-900">{erro}</p>}
    </section>
  );
}

function posicoesDisponiveis(periodos: Periodo[], grupo: number, ignorarId?: string): number[] {
  const ocupadas = new Set(periodos.filter(
    (periodo) => !periodo.intervalo && periodo.id !== ignorarId
      && (grupo === 0 || periodo.grupoIntervalo === 0 || periodo.grupoIntervalo === grupo),
  ).map(({ ordem }) => ordem));
  return posicoesDasAulas.filter((ordem) => !ocupadas.has(ordem));
}

function haAulasDisponiveis(periodos: Periodo[]): boolean {
  return [1, 2].some((grupo) => posicoesDisponiveis(periodos, grupo).length > 0);
}

function separarSeries(campo: FormDataEntryValue | null): string[] {
  return String(campo ?? "").split(",").map((serie) => serie.trim()).filter(Boolean);
}

function tipoDoPeriodo(periodo?: Periodo): string {
  const grupo = periodo?.grupoIntervalo ?? 0;
  if (periodo?.intervalo) return grupo === 0 ? "" : `intervalo-${grupo}`;
  return `aula-${grupo}`;
}

function rotuloPeriodo(periodo: Periodo): string {
  if (periodo.intervalo) return periodo.grupoIntervalo ? `${periodo.grupoIntervalo}º intervalo` : "Intervalo com grupo a definir";
  return periodo.grupoIntervalo ? `Aula do grupo ${periodo.grupoIntervalo}` : "Aula comum";
}

function mensagemApi(error: unknown): string {
  if (isAxiosError<{ message?: unknown }>(error)) {
    const mensagem = error.response?.data?.message;
    const status = error.response?.status;
    if (status === 404 && typeof mensagem === "string" && /^Cannot (GET|POST|PUT|DELETE) /i.test(mensagem)) {
      return "A API local ainda não disponibiliza o cadastro de turnos. Tente novamente após a atualização do servidor.";
    }
    if (typeof mensagem === "string" && status !== undefined && status < 500) return mensagem;
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}
