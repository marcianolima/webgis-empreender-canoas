/**
 * Comparative GeoCanoas choropleth.
 *
 * CNPJ (2026): declarations assigning a business to a named bairro, NOT points.
 * CNEFE (2022): observed non-residential address coordinates within official
 * polygons, subject to an aggregate count suppression threshold of 5.
 * Both densities use the same official neighborhood polygon area, but have
 * different years, data universes and levels of spatial precision.
 */
export type DistrictInput={id:number;name:string;areaKm2:number;population2022:number|null;active:number|null};
export type ObservedInput={bairro:string;areaKm2:number;observedAddresses:number|null;
 highQualityAddresses:number|null;fullCells:number;borderFragments:number};
export type Comparison={
 id:number;name:string;areaKm2:number;population2022:number|null;
 cnpjActive:number|null;cnefeObserved:number|null;cnefeHigh:number|null;
 cnpjPerKm2:number|null;cnefePerKm2:number|null;highQualityPct:number|null;
 fullCells:number;borderFragments:number;
 x:0|1|2|null;y:0|1|2|null;classIndex:number|null;
};
export type Statistic="bivariate"|"cnpjDensity"|"cnefeDensity"|"quality";

export const BIVARIATE_COLORS=[
 ["#e8e8e8","#ace4e4","#5ac8c8"],
 ["#dfb0d6","#a5add3","#5698b9"],
 ["#be64ac","#8c62aa","#3b4994"],
] as const;
// Rows = ascending observed CNEFE density (vertical), columns = ascending
// declared RFB CNPJ density (horizontal).
export const SINGLE_COLORS=["#d5eee3","#a7d9c5","#73bda2","#359b79","#116b55"] as const;
export const NODATA="#e2e8f0";

function normal(name:string){
 return name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim();
}
function areaDensity(n:number|null,area:number):number|null{
 return n!==null&&Number.isFinite(n)&&n>=0&&Number.isFinite(area)&&area>0?n/area:null;
}
function ranks(values:number[]):[number,number]{
 const sorted=values.slice().sort((a,b)=>a-b);
 if(!sorted.length)return [Infinity,Infinity];
 // Approximate terciles (all neighbors included; identical values share a bin).
 return [sorted[Math.floor((sorted.length-1)/3)],sorted[Math.floor(2*(sorted.length-1)/3)]];
}
export function class3(value:number|null,breaks:[number,number]):0|1|2|null{
 if(value===null||!Number.isFinite(value))return null;
 if(value<=breaks[0])return 0;
 if(value<=breaks[1])return 1;
 return 2;
}
export function buildComparison(districts:DistrictInput[],observed:ObservedInput[]):Comparison[]{
 if(districts.length!==18||observed.length!==18)throw Error("São necessários 18 bairros oficiais em cada fonte");
 const byName=new Map<string,ObservedInput>();
 for(const row of observed){
  const key=normal(row.bairro);
  if(byName.has(key))throw Error("Bairro CNEFE duplicado "+key);
  byName.set(key,row);
 }
 const results:Comparison[]=districts.map(r=>{
  const o=byName.get(normal(r.name));
  if(!o)throw Error("Bairro CNEFE ausente: "+r.name);
  if(!Number.isFinite(r.areaKm2)||r.areaKm2<=0||
    Math.abs(r.areaKm2-o.areaKm2)>Math.max(.005,r.areaKm2*.002)){
   throw Error("Áreas oficiais divergentes para "+r.name);
  }
  const cnefe=o.observedAddresses;
  const quality=o.highQualityAddresses;
  if(cnefe!==null&&quality!==null&&quality>cnefe)throw Error("Qualidade excede CNEFE para "+r.name);
  return {id:r.id,name:r.name,areaKm2:r.areaKm2,population2022:r.population2022,
   cnpjActive:r.active,cnefeObserved:cnefe,cnefeHigh:quality,
   cnpjPerKm2:areaDensity(r.active,r.areaKm2),cnefePerKm2:areaDensity(cnefe,r.areaKm2),
   highQualityPct:cnefe!==null&&cnefe>0&&quality!==null?100*quality/cnefe:null,
   fullCells:o.fullCells,borderFragments:o.borderFragments,x:null,y:null,classIndex:null};
 });
 const xBreaks=ranks(results.map(r=>r.cnpjPerKm2).filter((v):v is number=>v!==null));
 const yBreaks=ranks(results.map(r=>r.cnefePerKm2).filter((v):v is number=>v!==null));
 return results.map(r=>{
  const x=class3(r.cnpjPerKm2,xBreaks),y=class3(r.cnefePerKm2,yBreaks);
  return {...r,x,y,classIndex:x===null||y===null?null:y*3+x};
 });
}
export function displayValue(r:Comparison,m:Exclude<Statistic,"bivariate">):number|null{
 return m==="cnpjDensity"?r.cnpjPerKm2:
  m==="cnefeDensity"?r.cnefePerKm2:r.highQualityPct;
}
export function fifthBreaks(values:number[]):number[]{
 const sorted=values.filter(Number.isFinite).slice().sort((a,b)=>a-b);
 if(!sorted.length)return [];
 return Array.from(new Set([.2,.4,.6,.8].map(q=>sorted[Math.floor((sorted.length-1)*q)])))
  .filter(x=>x>sorted[0]);
}
export function singleColor(value:number|null,breaks:number[]):string{
 if(value===null||!Number.isFinite(value))return NODATA;
 let pos=0;
 for(const threshold of breaks)if(value>=threshold)pos++;
 return SINGLE_COLORS[Math.min(pos,SINGLE_COLORS.length-1)];
}
export function comparisonColor(r:Comparison,metric:Statistic,breaks:number[]=[]):string{
 if(metric==="bivariate")return r.x===null||r.y===null?NODATA:BIVARIATE_COLORS[r.y][r.x];
 return singleColor(displayValue(r,metric),breaks);
}
