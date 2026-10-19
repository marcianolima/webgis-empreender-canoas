/** Exploratory cell assignment only. Never conflate hexagon centroids with CNPJ locations. */
export type BairrosGeometry={
 type:"FeatureCollection";
 features:Array<{properties:{BAIRRO:string};geometry:
  {type:"Polygon";coordinates:number[][][]}|
  {type:"MultiPolygon";coordinates:number[][][][]}}>;
};
export type HexLocation={cell:string;lon:number;lat:number};
export function pointInRing(x:number,y:number,ring:number[][]):boolean{
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a[1]>y)!==(b[1]>y)){
   const crossing=(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0];
   if(x<crossing)inside=!inside;
  }
 }
 return inside;
}
function insidePolygon(x:number,y:number,rings:number[][][]):boolean{
 return rings.length>0&&pointInRing(x,y,rings[0])&&!rings.slice(1).some(r=>pointInRing(x,y,r));
}
export function assignBairros(cells:HexLocation[],data:BairrosGeometry|null):Map<string,string>{
 const result=new Map<string,string>();
 if(!data)return result;
 for(const cell of cells){
  if(!Number.isFinite(cell.lon)||!Number.isFinite(cell.lat))continue;
  for(const feature of data.features){
   const geom=feature.geometry;
   const polygons=geom.type==="Polygon"?[geom.coordinates]:geom.coordinates;
   if(polygons.some(poly=>insidePolygon(cell.lon,cell.lat,poly))){
    result.set(cell.cell,feature.properties.BAIRRO);
    break;
   }
  }
 }
 return result;
}
