import type { Metadata } from "next";
import { CnpjDashboard } from "@/components/cnpj-dashboard";
export const metadata: Metadata = {
  title: "Receita Federal — CNPJ Canoas | Canoas Empreende",
  description: "Indicadores cadastrais oficiais do CNPJ em Canoas, publicados apenas após carga completa da Receita Federal.",
};
export default function CnpjPage() { return <CnpjDashboard/>; }
