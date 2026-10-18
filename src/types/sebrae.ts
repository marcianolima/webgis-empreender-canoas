export type SebraeTheme="empresas"|"emprego"|"ocupacoes"|"demografia"|"educacao"|"financas"|"desenvolvimento"|"agro"|"comercio";
export interface SebraeMetric {
  code:string; theme:SebraeTheme; label:string; year:number; period:string;
  value:number;unit:string;provider:string;notes:string;sourceUrl:string;
}
export interface SebraeDocument {
  schemaVersion:1;status:"not_loaded"|"verified";
  municipality:string;municipalityIbgeCode:string;sourceUrl:string;
  generatedAt:string|null;sebraeBuildTime?:string|null;
  groups:Partial<Record<SebraeTheme,string>>;
  metrics:SebraeMetric[];
  history:Record<string,{year:number;value:number}[]>;
  archived:{observedOn:string;observations:SebraeMetric[]};
  quality:{notes:string[];limits:{topic:string;reason:string}[]};
}
