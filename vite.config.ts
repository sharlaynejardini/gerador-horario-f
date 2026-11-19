import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

function isPublishableKey(key: string): boolean {
  if (key.startsWith("sb_publishable_")) return true;
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
    return payload.role === "anon";
  } catch {
    return false;
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (key && !isPublishableKey(key)) {
    throw new Error("Use somente a chave pública do Supabase no frontend.");
  }
  for (const name of ["VITE_SUPABASE_URL", "VITE_API_URL"]) {
    const url = env[name] && URL.parse(env[name]);
    if (url && (url.username || url.password)) {
      throw new Error(`Remova as credenciais de ${name}.`);
    }
  }
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: { port: 5173, strictPort: true },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (key && id.includes("/node_modules/@supabase/")) return "supabase";
          },
        },
      },
    },
  };
});
