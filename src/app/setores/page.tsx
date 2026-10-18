import type { Metadata } from "next";
import { SectorsDashboard } from "@/components/sectors-dashboard";
export const metadata: Metadata = { title:"Setores Econômicos | Canoas Empreende", description:"Indicadores municipais reais de agricultura, pecuária, extrativismo e valor adicionado via IBGE." };
export default function SetoresPage(){return <SectorsDashboard/>;}
