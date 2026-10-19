"use client";
import {useEffect,useMemo,useState} from "react";
import {Bar,BarChart,CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {ChartColumnIncreasing,ChartNoAxesCombined,ChartSpline,Info,ShieldCheck} from "lucide-react";

const base=process.env.NEXT_PUBLIC_BASE_PATH||"";
const number=new Intl.NumberFormat("pt-BR");
const percent=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1});
const CNAE:Record<string,string>={
 A:"Agropecuária",B:"Indústrias extrativas",C:"Indústrias de transformação",
 D:"Eletricidade e gás",E:"Água e saneamento",F:"Construção",G:"Comércio",
 H:"Transporte e armazenagem",I:"Alojamento e alimentação",J:"Informação e comunicação",
 K:"Finanças",L:"Atividades imobiliárias",M:"Profissionais e técnicas",
 N:"Administrativas",O:"Administração pública",P:"Educação",Q:"Saúde",
 R:"Artes e recreação",S:"Outros serviços",T:"Serviços domésticos",
 U:"Organismos internacionais"
};
type PublishedCell={cell:string;matched:number;[sector:string]:string|number};
type Coverage={active:number;matched:number;matchedInPublishedCells:number;matchedPercent:number;cellsPublished:number;
 unpublishedBelowPrivacyThreshold?:number};
type Snapshot={reference:string;coverage:Coverage;cells:PublishedCell[]};
type Series={schemaVersion:number;territory:string;snapshots:Snapshot[]};
type PublicCell={cell:string;cnpj?:number;lon:number;lat:number;[key:string]:string|number|null|undefined};
type Props={reference:string;coverage:Coverage;cells:PublicCell[];selectedSector:string;
 onSelectCell:(id:string,lon:number,lat:number)=>void};
export function CnpjSpatialInsights({reference,coverage,cells,selectedSector,onSelectCell}:Props){
 const [historical,setHistorical]=useState<Series|null>(null);
 const [error,setError]=useState("");
 const [focus,setFocus]=useState("all");
 useEffect(()=>{
  const ctl=new AbortController();
  fetch(base+"/data/cnpj-geo-hex500-series.json",{cache:"no-store",signal:ctl.signal})
   .then(r=>{if(!r.ok)throw Error("Histórico HTTP "+r.status);return r.json();})
   .then((x:Series)=>{
    if(x.territory!=="4304606"||x.schemaVersion!==1||!Array.isArray(x.snapshots))throw Error("Histórico territorial inválido");
    setHistorical(x);
   }).catch(e=>{if(e.name!=="AbortError")setError(String(e))});
  return ()=>ctl.abort();
 },[]);
 const safeCells=useMemo(()=>cells.filter(c=>typeof c.cnpj==="number"&&c.cnpj>=5),[cells]);
 const ordered=useMemo(()=>[...safeCells].sort((a,b)=>Number(b.cnpj)-Number(a.cnpj)),[safeCells]);
 const top10=ordered.slice(0,10).reduce((total,c)=>total+Number(c.cnpj),0);
 const published=ordered.reduce((total,c)=>total+Number(c.cnpj),0);
 const topShare=published>0?top10/published*100:null;
 const sectors=useMemo(()=>Object.entries(CNAE).map(([code,label])=>{
  const n=cells.reduce((sum,c)=>sum+(typeof c["cs"+code]==="number"?Number(c["cs"+code]):0),0);
  const withCount=cells.filter(c=>typeof c["cs"+code]==="number").length;
  return {code,label,minimum:n,cells:withCount};
 }).filter(x=>x.minimum>0).sort((a,b)=>b.minimum-a.minimum),[cells]);
 const selected=useMemo(()=>ordered.filter(c=>focus==="all"||typeof c["cs"+focus]==="number")
   .map(c=>({id:c.cell,lon:c.lon,lat:c.lat,
    count:focus==="all"?Number(c.cnpj):Number(c["cs"+focus])}))
   .sort((a,b)=>b.count-a.count).slice(0,20),[ordered,focus]);
 const historicalRows=useMemo(()=>[...(historical?.snapshots||[])].filter(s=>s.reference<=reference)
    .sort((a,b)=>a.reference.localeCompare(b.reference))
    .map(s=>({reference:s.reference,matched:s.coverage.matched,publicados:s.coverage.matchedInPublishedCells,
      percent:s.coverage.matchedPercent,cells:s.coverage.cellsPublished})),[historical,reference]);
 const historicalComparable=historicalRows.length>=2;
 const missing=coverage.active-coverage.matched;
 const fraction=published?100*published/coverage.matched:0;
 return <section className="space-y-4" aria-label="Análise espacial do subconjunto de empresas localizadas">
  <header className="space-y-2">
   <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700"><ChartNoAxesCombined size={15}/> Inteligência espacial · subset de CNPJs geocodificados</div>
   <h2 className="text-lg font-extrabold sm:text-xl">Onde se concentram os CNPJs com endereço conciliado?</h2>
   <p className="max-w-4xl text-xs leading-relaxed text-slate-600">
    Análise exploratória dos {number.format(coverage.matched)} estabelecimentos associados ao CNEFE, competência {reference}.
    A concentração retrata <strong>apenas esse subconjunto</strong>, não o universo dos {number.format(coverage.active)} CNPJs de Canoas.
    {number.format(missing)} empresas ainda não possuem correspondência espacial verificada.
   </p>
  </header>
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
   {[
    ["Cobertura exata",percent.format(coverage.matchedPercent)+"%","Dos CNPJs ativos do município"],
    ["Células publicáveis",number.format(coverage.cellsPublished),"Com ao menos 5 endereços conciliados"],
    ["Parcela das 10 maiores células",topShare===null?"N/D":percent.format(topShare)+"%","Entre registros geocodificados publicáveis"],
    ["Geocódigos não expostos",number.format(coverage.unpublishedBelowPrivacyThreshold??coverage.matched-coverage.matchedInPublishedCells),"Correspondências em células abaixo do limiar"],
   ].map(([label,value,note])=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
    <p className="text-xs font-semibold uppercase leading-relaxed text-slate-500">{label}</p>
    <p className="mt-2 break-words text-2xl font-extrabold tabular-nums">{value}</p>
    <p className="mt-1 text-xs leading-relaxed text-slate-500">{note}</p>
   </div>)}
  </div>
  <div className="grid gap-4 lg:grid-cols-2">
   <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <h3 className="flex items-center gap-2 text-sm font-bold"><ChartColumnIncreasing size={16}/> Maior concentração por hexágono</h3>
     <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">Recorte
      <select aria-label="Seção CNAE do ranking econômico" value={focus} onChange={e=>setFocus(e.target.value)} className="max-w-[190px] rounded-lg border border-slate-200 bg-white p-2 font-normal">
       <option value="all">Todos os CNAEs conciliados</option>
       {sectors.map(s=><option key={s.code} value={s.code}>{s.code} · {s.label}</option>)}
      </select>
     </label>
    </div>
    <p className="mt-2 text-xs text-slate-500">As 20 células com maiores contagens publicáveis. Selecione uma barra para posicionar o mapa.</p>
    <div className="mt-3 h-[340px] w-full" role="img" aria-label="Ranking dos maiores hexágonos empresariais conciliados">
     <ResponsiveContainer width="100%" height="100%"><BarChart data={selected} layout="vertical" margin={{left:4,right:18}}>
      <CartesianGrid horizontal={false} stroke="#e7eeeb"/>
      <XAxis type="number" tick={{fontSize:10}}/>
      <YAxis type="category" dataKey="id" width={84} tick={{fontSize:10}}/>
      <Tooltip formatter={v=>number.format(Number(v))} labelFormatter={v=>"Hexágono "+v}/>
      <Bar dataKey="count" name="CNPJs conciliados" fill="#087f66" radius={[0,4,4,0]}
       onClick={(point)=>{const id=String(point.id??"");const item=selected.find(c=>c.id===id);if(item)onSelectCell(item.id,item.lon,item.lat);}}/>
     </BarChart></ResponsiveContainer>
    </div>
    <p className="mt-2 text-[11px] leading-relaxed text-amber-800">Não comparar esta concentração amostral diretamente com a densidade total de empresas por bairro. A taxa de geocodificação pode variar conforme o endereço.</p>
   </div>
   <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <h3 className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16}/> CNAE espacializado · mínimo verificável</h3>
    <p className="mt-2 text-xs leading-relaxed text-slate-500">A soma por seção representa o mínimo divulgado após supressões de privacidade. Não é distribuição completa do universo, nem a composição exata dos {number.format(coverage.matched)} endereços conciliados.</p>
    <div className="mt-4 max-h-[360px] space-y-2 overflow-auto">
     {sectors.map(s=><button key={s.code} onClick={()=>setFocus(s.code)}
       className={"w-full rounded-xl border p-3 text-left "+(focus===s.code?"border-brand-500 bg-brand-50":"border-slate-100 hover:bg-slate-50")}>
      <div className="flex items-center justify-between gap-2 text-xs">
       <span className="font-semibold">{s.code} · {s.label}</span>
       <strong className="tabular-nums">≥{number.format(s.minimum)}</strong>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
       <div className="h-full rounded-full bg-brand-600" style={{width:(100*s.minimum/(sectors[0]?.minimum||1))+"%"}}/>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">{number.format(s.cells)} hexágonos com contagem publicável na seção</p>
     </button>)}
     {!sectors.length&&<p className="text-sm text-slate-500">Não há seções disponíveis para este subconjunto.</p>}
    </div>
   </div>
  </div>
  <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
   <h3 className="flex items-center gap-2 text-sm font-bold"><ChartSpline size={16}/> Histórico da geocodificação empresarial</h3>
   {error&&<p className="mt-3 text-xs text-amber-800">{error}</p>}
   {historicalComparable?<>
    <p className="mt-2 text-xs leading-relaxed text-slate-600">Fotografias mensais preservadas. Mudanças nas correspondências podem decorrer de mudanças no cadastro, atualização dos endereços ou alterações no processo de conciliação. Não representam automaticamente aberturas e baixas de empresas.</p>
    <div className="mt-4 h-[260px] w-full" role="img" aria-label="Histórico de correspondências espaciais CNPJ">
     <ResponsiveContainer width="100%" height="100%">
      <LineChart data={historicalRows} margin={{left:4,right:14,bottom:6}}>
       <CartesianGrid vertical={false} stroke="#e7eeeb"/>
       <XAxis dataKey="reference" tick={{fontSize:11}}/>
       <YAxis tick={{fontSize:10}}/>
       <Tooltip formatter={v=>number.format(Number(v))}/>
       <Legend wrapperStyle={{fontSize:11}}/>
       <Line type="monotone" dataKey="matched" name="CNPJs conciliados" stroke="#087f66" dot/>
       <Line type="monotone" dataKey="publicados" name="Em hexágonos publicáveis" stroke="#b47e39" dot/>
      </LineChart>
     </ResponsiveContainer>
    </div>
   </>:<p className="mt-3 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
    Há {historicalRows.length||0} fotografia geográfica homologada até {reference}. O histórico foi estruturado, mas um gráfico de evolução só será exibido após existir uma segunda competência realmente processada. Não se reconstrói o estoque espacial de meses anteriores a partir do cadastro atual.
   </p>}
  </section>
  <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-600"><Info size={15} className="mt-0.5 shrink-0"/> Interpretação: o percentual das dez maiores células usa como denominador apenas os {number.format(published)} estabelecimentos em células com contagem publicável ({percent.format(fraction)}% das correspondências). Nenhum ponto individual de estabelecimento é publicado.</p>
 </section>;
}
