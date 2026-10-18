import type {Metadata} from "next";
import {SebraeSeriesDashboard} from "@/components/sebrae-series-dashboard";
export const metadata:Metadata={
 title:"Séries Históricas Sebrae | Canoas Empreende",
 description:"Explore séries públicas municipais do Sebrae: RAIS, CAGED, CNPJ, REDESIM, comércio exterior, SICONFI, educação, orçamento, demografia, turismo, crédito e agropecuária, com filtros e comparativos."
};
export default function SebraeSeriesPage(){return <SebraeSeriesDashboard/>;}
