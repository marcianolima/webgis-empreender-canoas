import type {Metadata} from "next";
import {SebraeLiveQuery} from "@/components/sebrae-live-query";
export const metadata:Metadata={
 title:"Consulta Multidimensional Pública | Sebrae Canoas Empreende",
 description:"Explore cubos OLAP públicos do Sebrae com filtros de dimensões, medidas, período e município de Canoas (IBGE 4304606), gráficos interativos e exportação CSV."
};
export default function SebraeConsulta(){return <SebraeLiveQuery/>;}
