export type Status = "02" | "08";
export type Porte = "01" | "03" | "05";
export type Business = {
  id: string;
  nome: string;
  cnae: string;
  setor: string;
  divisao: string;
  porte: Porte;
  bairro: string;
  inicio: string;
  baixa?: string;
  status: Status;
  mei: boolean;
  simples: boolean;
  longitude: number;
  latitude: number;
};
export type Period = "3" | "6" | "12" | "all";
export type MapMode = "points" | "heatmap";
export type BusinessFilters = {
  query: string;
  period: Period;
  sector: string;
  porte: string;
  status: string;
  bairro: string;
  meiOnly: boolean;
};
