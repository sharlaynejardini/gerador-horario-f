import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const apiUrl = import.meta.env.VITE_API_URL;

function isWebUrl(value: string | undefined) {
  return typeof value === "string" && URL.canParse(value) && ["https:", "http:"].includes(new URL(value).protocol);
}

export const supabase = isWebUrl(supabaseUrl) && key && isWebUrl(apiUrl)
  ? createClient(supabaseUrl, key)
  : null;

const api = axios.create({ baseURL: apiUrl, timeout: 15_000 });

export interface Perfil {
  id: string;
  email: string | null;
  nome: string | null;
  escolas: Array<{
    papel: "ADMIN" | "GESTOR" | "VISUALIZADOR";
    escola: { id: string; nome: string; fusoHorario: string };
  }>;
}

export async function obterPerfil(token: string, signal: AbortSignal): Promise<Perfil> {
  const { data } = await api.get<Perfil>("/me", {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export interface PeriodoDados {
  ordem: number;
  inicio: string;
  fim: string;
  intervalo: boolean;
  grupoIntervalo: number;
}

export interface Periodo extends PeriodoDados {
  id: string;
}

export interface TurnoDados {
  nome: string;
  seriesGrupo1: string[];
  seriesGrupo2: string[];
}

export interface Turno extends TurnoDados {
  id: string;
  periodos: Periodo[];
}

export function turnosDaEscola(escolaId: string, token: string) {
  const base = `/escolas/${escolaId}/turnos`;
  const config = { headers: { Authorization: `Bearer ${token}` } };
  return {
    async listar(signal: AbortSignal): Promise<Turno[]> {
      const { data } = await api.get<Turno[]>(base, { ...config, signal });
      return data;
    },
    async salvarTurno(dados: TurnoDados, id?: string): Promise<string> {
      const { data } = id
        ? await api.put<Pick<Turno, "id">>(`${base}/${id}`, dados, config)
        : await api.post<Pick<Turno, "id">>(base, dados, config);
      return data.id;
    },
    async salvarPeriodo(turnoId: string, dados: PeriodoDados, id?: string) {
      const caminho = `${base}/${turnoId}/periodos`;
      if (id) await api.put(`${caminho}/${id}`, dados, config);
      else await api.post(caminho, dados, config);
    },
    async excluir(turnoId: string, periodoId?: string) {
      await api.delete(`${base}/${turnoId}${periodoId ? `/periodos/${periodoId}` : ""}`, config);
    },
  };
}
