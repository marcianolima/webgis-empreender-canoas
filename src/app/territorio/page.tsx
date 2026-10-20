import type {Metadata} from "next";
import {TerritorialIntelligenceDashboard} from "@/components/territorial-intelligence-dashboard";

export const metadata:Metadata={
 title:"Inteligência Territorial Comparativa | Canoas Empreende",
 description:"Mapa bivariado dos 18 bairros oficiais GeoCanoas: CNPJs ativos declarados na Receita Federal e densidade de endereços IBGE CNEFE 2022, com qualidade cartográfica e PMTiles."
};
export default function TerritorialIntelligencePage(){return <TerritorialIntelligenceDashboard/>;}
