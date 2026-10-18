export type DeeObservation = {
  metric: string; year: number; value: number; unit: string;
  territory: "4304606"; label: string; source: string; sourceUrl: string;
};
export type DeeDocument = {
  schemaVersion: number; status: "not_loaded"|"ok"|"partial"; territory: string;
  municipality: string; generatedAt: string|null;
  observations: DeeObservation[];
  quality: {errors:string[];notes:string[]};
};
