export type CnpjCount = { name: string; count: number };
export type CnpjSector = { name: string; label: string; count: number };
export type CnpjMonth = { month: string; openings: number; closingsLatestSituation: number };
export type CnpjSnapshot = {
  schemaVersion: 1;
  status: "not_loaded" | "official";
  reference: string | null;
  generatedAt: string | null;
  municipality: string;
  municipalityIbgeCode: string;
  source: string;
  sourceUrl: string;
  unit?: string;
  coverage?: {
    establishmentShards: number;
    companyShards: number;
    simplesLoaded: boolean;
    recordsMunicipality: number;
    dateFieldOrderVerified?: boolean;
    totalRowsReadEstablishments: number;
  };
  kpis: null | {
    total: number; active: number; baixados_snapshot: number; openMonth: number;
    openYear: number; closedYearLatestSituation: number; balanceYearProxy: number;
    meiActive: number; meiKnown: number; simplesActive: number; simplesKnown: number;
  };
  bySector: CnpjSector[];
  byPorte: CnpjCount[];
  byDistrictDeclared: CnpjCount[];
  monthly: CnpjMonth[];
  districtSectorCells: { district: string; sector: string; count: number }[];
  quality: { locationPrecision?: string; geocodedRecords?: number; notes: string[] };
};
