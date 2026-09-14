import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Veredito = { ok: boolean; motivo: string };

export const verificarFoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dataUrl: string }) => {
    if (typeof input?.dataUrl !== "string" || !input.dataUrl.startsWith("data:image/")) {
      throw new Error("Envie uma imagem válida.");
    }
    if (input.dataUrl.length > 8_000_000) {
      throw new Error("A foto é muito grande. Tente uma imagem menor.");
    }
    return { dataUrl: input.dataUrl };
  })
  .handler(async ({ data }): Promise<Veredito> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: true, motivo: "Verificação automática indisponível." };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você revisa fotos enviadas por alunos como prova de coleta de recicláveis em uma escola. " +
              'Responda SOMENTE em JSON: {"aprovada": boolean, "motivo": "frase curta em português"}. ' +
              "Aprove apenas se a foto mostrar materiais recicláveis, resíduos, sacos, caixas, garrafas, " +
              "latas, papel ou pessoas junto desse material. " +
              "Reprove se for nudez, violência, conteúdo sexual, ofensivo, print de tela, meme, " +
              "documento pessoal, foto aleatória sem relação com coleta, ou se estiver ilegível.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Esta foto serve como prova de coleta?" },
              { type: "image_url", image_url: { url: data.dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return { ok: false, motivo: "Muitas verificações agora. Tente novamente em instantes." };
      }
      return { ok: false, motivo: "Não foi possível verificar a foto agora. Tente novamente." };
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const texto = payload.choices?.[0]?.message?.content ?? "";
    const bruto = texto.replace(/```json|```/g, "").trim();
    const inicio = bruto.indexOf("{");
    const fim = bruto.lastIndexOf("}");

    try {
      const parsed = JSON.parse(bruto.slice(inicio, fim + 1)) as {
        aprovada?: boolean;
        motivo?: string;
      };
      return {
        ok: parsed.aprovada === true,
        motivo: parsed.motivo?.slice(0, 200) || "Foto reprovada pela verificação automática.",
      };
    } catch {
      return { ok: false, motivo: "Não foi possível verificar a foto. Tente outra imagem." };
    }
  });
