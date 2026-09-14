import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export function FotoColeta({ path }: { path: string | null }) {
  const url = useQuery({
    queryKey: ["foto-coleta", path],
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("coletas-fotos")
        .createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  if (!path) {
    return (
      <div
        className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground"
        title="Sem foto"
      >
        <ImageOff className="size-4" />
      </div>
    );
  }

  return (
    <a
      href={url.data ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="size-14 shrink-0 overflow-hidden rounded-lg bg-secondary"
    >
      {url.data ? (
        <img
          src={url.data}
          alt="Foto da coleta registrada"
          loading="lazy"
          className="size-full object-cover"
        />
      ) : null}
    </a>
  );
}
