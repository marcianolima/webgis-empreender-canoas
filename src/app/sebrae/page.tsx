import type { Metadata } from "next";
import { SebraeDashboard } from "@/components/sebrae-dashboard";
export const metadata:Metadata={
  title:"Sebrae | Panorama Socioeconômico de Canoas — Canoas Empreende",
  description:"Emprego RAIS, remuneração, ocupações, micro e pequenos negócios, atendimento Sebrae, educação, orçamento e indicadores socioeconômicos do perfil público de Canoas, com metodologia e históricos.",
};
export default function SebraePage(){return <SebraeDashboard/>;}
