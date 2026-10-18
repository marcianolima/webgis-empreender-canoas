export type BairrosGeoRow = {
 id:number; name:string; active:number|null; areaKm2:number;
 population2022:number|null; densityKm2:number|null; per1000Population:number|null;
 sectorCounts:Record<string,number>;
};
export type BairrosSnapshot = {
 reference:string;generatedAt:string;geometrySource:string;
 sourceYearPopulation:number;neighborhoods:BairrosGeoRow[];
 coverage:{activeTotal:number;declaredPublished:number;matched:number;unmatchedPublished:number;notPublishedByThreshold:number;matchedPercent:number;sectorCellsPublished:number};
 unmatched:{name:string;count:number;reason:string}[];
};
export type BairrosGeoData={
 schemaVersion:1;status:"not_loaded"|"verified";territory:string;reference:string|null;
 generatedAt?:string;sourceUrl:string;sourceCnpj?:string;
 pmtiles:null|{path:string;layer:string;bytes:number;sha256:string;geometryCount:number;crsSource:string;crsTiles:string};
 coverage:BairrosSnapshot["coverage"]|null;population2022LayerSum?:number;areaKm2OfficialPolygons?:number;
 neighborhoods:BairrosGeoRow[];unmatched:{name:string;count:number;reason:string}[];
 sectors:{code:string;label:string}[];notes:string[];
};
export type BairrosGeoHistory={schemaVersion:1;territory:string;snapshots:BairrosSnapshot[]};
