export type SeriesValue=string|number|null;
export type SeriesRow=Record<string,SeriesValue>;
export type SebraeSeriesDataset={
 id:string;title:string;topic:string;cube:string;status:"ok"|"empty"|"unavailable";
 stale:boolean;notes:string;unit:string;
 dimensions:string[];filters:Record<string,string>;requestedMeasures:string[];
 measures?:string[];rows?:SeriesRow[];rowCount?:number;returnedCount?:number;
 years?:number[];reason?:string;lastSuccessAt?:string|null;latestError?:string;
 suppressedSmallCells?:number;annotations?:{source_name?:string;source_description?:string;source_link?:string;table?:string};sourceUrl?:string;
};
export type SebraeSeriesCatalog={
 name:string;caption:string;source:string;dimensions:string[];measures:string[];hasMunicipality:boolean;
};
export type SebraeSeriesDocument={
 schemaVersion:1;status:"not_loaded"|"ok"|"partial";municipality:string;municipalityIbgeCode:string;
 sourceUrl:string;apiUrl:string;generatedAt:string|null;
 datasets:SebraeSeriesDataset[];catalog:SebraeSeriesCatalog[];
 coverage:{specifications:number;available:number;unavailable:number;preservedFromPrevious:number;catalogCubes:number;rows:number};
 methodology:string[];
};
