import type {Metadata} from "next";
import {Hex500Dashboard} from "@/components/hex500-dashboard";
export const metadata:Metadata={title:"Hexágonos 500 m e Mapas de Calor | Canoas Empreende",description:"Endereços não domiciliares georreferenciados do IBGE CNEFE 2022 agregados em 662 hexágonos de 500 metros e mapas de calor PMTiles, com limites oficiais de bairros GeoCanoas."};
export default function Hex500Page(){return <Hex500Dashboard/>;}
