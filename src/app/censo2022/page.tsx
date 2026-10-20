import type {Metadata} from "next";
import {Censo2022SetoresDashboard} from "@/components/censo2022-setores-dashboard";
export const metadata:Metadata={
 title:"Atlas Censo 2022 por Setores Censitários | Canoas Empreende",
 description:"Malhas oficiais IBGE 2022 de Canoas em PMTiles, população, domicílios, demografia, renda, filtros espaciais GeoCanoas, comparação setorial e contexto de empresas."
};
export default function CensusSectorsPage(){return <Censo2022SetoresDashboard/>;}
