export type SectorObservation = {
  group: string;
  year: number;
  metric: string;
  category: string;
  label: string;
  value: number;
  unit: string;
  sourceTable: number;
  sourceUrl: string;
  territory: "4304606";
};
export type SectorsDocument = {
  schemaVersion: 1;
  status: "not_loaded"|"partial"|"ok";
  generatedAt: string|null;
  territory: string;
  municipality: string;
  observations: SectorObservation[];
  quality: {errors: string[];notes: string[]};
};
