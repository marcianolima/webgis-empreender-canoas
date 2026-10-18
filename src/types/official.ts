export type AnnualObservation = { year: number; value: number };
export type CnaeObservation = { year: number; value: number; category: string; label: string };
export type RsObservation = { month: string; value: number; territory: "43"; group: string; sourceUrl: string };
export type DataSource = { name: string; url: string; territory: string; reference: string };
export type OfficialEconomy = {
  schemaVersion: number;
  generatedAt: string | null;
  municipality: { code: "4304606"; name: string; state: "RS" };
  sources: DataSource[];
  cempre: AnnualObservation[];
  cempreCurrent?: AnnualObservation[];
  cnaeCurrent?: CnaeObservation[];
  cnae: CnaeObservation[];
  gdp: AnnualObservation[];
  population: AnnualObservation[];
  populationEstimate?: AnnualObservation[];
  rsBusiness: RsObservation[];
  quality: { status: "not_collected" | "ok" | "partial" | "unavailable"; errors: string[]; notes: string[] };
};
