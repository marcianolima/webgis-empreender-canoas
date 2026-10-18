import type {Metadata} from "next";
import {BairrosDashboard} from "@/components/bairros-dashboard";
export const metadata:Metadata={
 title:"Mapa Econômico por Bairros | Canoas Empreende",
 description:"Mapa oficial BAIRROSOFICIAL GeoCanoas em PMTiles com estabelecimentos CNPJ, densidade por km², taxas por mil habitantes, setores CNAE e séries históricas."
};
export default function BairrosPage(){return <BairrosDashboard/>;}
