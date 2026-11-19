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
