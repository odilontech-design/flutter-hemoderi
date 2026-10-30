"use client";

import { useRouter } from "next/navigation";
import { OutroEndereco } from "@/components/OutroEndereco";

/** "+ Novo local" do catálogo: cadastra ali mesmo e já deixa o local novo escolhido. */
export function NovoLocal() {
  const router = useRouter();
  return <OutroEndereco aoCriar={(id) => router.push(`/portal/catalogo?local=${id}`)} />;
}
