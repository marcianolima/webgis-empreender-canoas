import type { Metadata } from "next";
import { DeeDashboard } from "@/components/dee-dashboard";
export const metadata: Metadata={title:"Emprego e Exportações | Canoas Empreende",description:"Vínculos formais e exportações de Canoas com dados municipais oficiais DEE/DataRS."};
export default function TrabalhoPage(){return <DeeDashboard/>;}
