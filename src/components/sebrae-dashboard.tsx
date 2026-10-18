"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {ResponsiveContainer,LineChart,Line,CartesianGrid,XAxis,YAxis,Tooltip,BarChart,Bar} from "recharts";
import {ArrowUpRight,Download,ExternalLink,Search,ShieldAlert} from "lucide-react";
import type {SebraeDocument,SebraeMetric,SebraeTheme} from "@/types/sebrae";
import type {CnpjSnapshot} from "@/types/cnpj";
const base=process.env.NEXT_PUBLIC_BASE_PATH||"";
const num=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2});
const brl=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:2});
const themes:{id:SebraeTheme;label:string;desc:string;href?:string}[]=[
{id:"empresas",label:"Empresas e Sebrae",desc:"Formalização, porte, natureza jurídica, CNAE e atendimento",href:"/cnpj"},
{id:"emprego",label:"Emprego e salários",desc:"RAIS, emprego, remuneração e distribuição por sexo",href:"/trabalho"},
{id:"ocupacoes",label:"Ocupações",desc:"Profissões demandadas e qualificação"},
{id:"financas",label:"Finanças e PIB",desc:"Receitas municipais e composição do PIB",href:"/"},
{id:"educacao",label:"Educação e talentos",desc:"Qualificação, ensino superior e educação básica"},
{id:"demografia",label:"Mercado consumidor",desc:"População e demografia"},
{id:"desenvolvimento",label:"Inclusão e IDHM",desc:"Desenvolvimento, programas sociais e acesso a serviços"},
{id:"agro",label:"Agronegócio",desc:"Agropecuária e produção local",href:"/setores"},
{id:"comercio",label:"Comércio exterior",desc:"Fluxos e parceiros comerciais",href:"/trabalho"}
];
function fmt(m:SebraeMetric){
 if(m.unit==="BRL"||m.unit==="BRL/mês")return brl.format(m.value);
 if(m.unit==="%")return num.format(m.value)+"%";
 if(m.unit==="índice")return m.value.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3});
 return num.format(m.value)+(m.unit==="pontos"?" pontos":"");
}
function Card({m,archived}:{m:SebraeMetric;archived:boolean}){
 return <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
   <div className="flex flex-wrap justify-between gap-2">
     <h3 className="max-w-[80%] text-xs font-bold uppercase leading-relaxed text-slate-600">{m.label}</h3>
     {archived&&<span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">Arquivo</span>}
   </div>
   <div className="mt-3 break-words text-2xl font-extrabold">{fmt(m)}</div>
   <p className="mt-2 text-xs font-semibold text-brand-700">{m.period} · {m.unit}</p>
   <p className="mt-2 text-xs text-slate-500">Fonte: {m.provider}</p>
   {m.notes&&<p className="mt-3 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-600">{m.notes}</p>}
   <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 underline">Consultar Sebrae <ExternalLink size={12}/></a>
 </article>;
}
export function SebraeDashboard(){
 const [doc,setDoc]=useState<SebraeDocument|null>(null);
 const [cnpj,setCnpj]=useState<CnpjSnapshot|null>(null);
 const [error,setError]=useState("");
 const [theme,setTheme]=useState<SebraeTheme>("empresas");
 const [query,setQuery]=useState("");
 const [archived,setArchived]=useState(true);
 useEffect(()=>{
  const ctrl=new AbortController();
  fetch(base+"/data/sebrae.json",{signal:ctrl.signal,cache:"no-store"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()})
  .then((d:SebraeDocument)=>{if(d.schemaVersion!==1||d.municipalityIbgeCode!=="4304606")throw Error("Território incorreto");setDoc(d);})
  .catch(e=>{if(e.name!=="AbortError")setError(String(e))});
  fetch(base+"/data/cnpj.json",{signal:ctrl.signal}).then(r=>r.ok?r.json():null)
  .then((d:CnpjSnapshot|null)=>{if(d?.status==="official"&&d.municipalityIbgeCode==="4304606")setCnpj(d);})
  .catch(()=>null);
  return ()=>ctrl.abort();
 },[]);
 const source=doc?.metrics||[];
 const historic=archived?doc?.archived.observations||[]:[];
 const all=useMemo(()=>[...source,...historic],[source,historic]);
 const filtered=all.filter(x=>x.theme===theme&&(x.label+" "+x.provider+" "+x.notes).toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))).sort((a,b)=>b.year-a.year||a.label.localeCompare(b.label,"pt-BR"));
 const historicalCodes=new Set(doc?.archived.observations.map(x=>x.code)||[]);
 const get=(code:string)=>source.find(x=>x.code===code);
 const jobs=get("rais_vinculos"),wage=get("rais_remuneracao"),active=get("rf_empresas_ativas_sebrae"),clients=get("sebrae_atendimentos");
 const diff=active&&cnpj?.kpis?cnpj.kpis.active-active.value:null;
 const series=doc?.history.rais_vinculos||[];
 const salaries=doc?.history.rais_remuneracao||[];
 const trend=series.map(x=>({year:String(x.year),workers:x.value,wage:salaries.find(y=>y.year===x.year)?.value??null}));
 const chosen=themes.find(x=>x.id===theme);
 function csv(){
  if(doc?.status!=="verified")return;
  const rows=[["codigo","eixo","indicador","ano","competencia","valor","unidade","fonte","url","situacao"],
   ...all.map(m=>[m.code,m.theme,m.label,String(m.year),m.period,String(m.value),m.unit,m.provider,m.sourceUrl,historicalCodes.has(m.code)?"arquivo":"coleta"]) ];
  const body="\ufeff"+rows.map(r=>r.map(x=>'"'+x.replaceAll('"','""')+'"').join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([body],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="sebrae-canoas-indicadores.csv";a.click();URL.revokeObjectURL(url);
 }
 return <main className="mx-auto max-w-[1500px] space-y-6 px-4 pb-16 pt-8 text-ink sm:px-6">
  <Link href="/" className="text-sm font-bold text-brand-700">← Painel principal</Link>
  <div className="flex flex-wrap items-end justify-between gap-4">
   <div><span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">Observatório Setorial Territorial · Sebrae</span>
    <h1 className="mt-4 text-2xl font-extrabold sm:text-4xl">Panorama socioeconômico de Canoas</h1>
    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">Empresas, emprego, salários, ocupações, educação, mercado consumidor e contexto para investimentos. Indicadores com fonte, unidade e ano de referência.</p>
   </div>
   <button disabled={doc?.status!=="verified"} onClick={csv} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Download size={16}/> Exportar CSV</button>
  </div>
  {error&&<div role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-800">{error}</div>}
  {!doc&&!error&&<p className="text-sm text-slate-500">Carregando dados verificados…</p>}
  {doc?.status==="not_loaded"&&<p className="rounded-xl bg-amber-50 p-5 text-sm text-amber-900">A coleta complementar ainda não foi publicada. Não há números simulados.</p>}
  {doc?.status==="verified"&&<>
   <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {[
     ["Vínculos formais RAIS",jobs,"Estoque anual; não é Caged"],
     ["Remuneração média mensal",wage,"Nominal, RAIS"],
     ["Empresas ativas — Sebrae",active,"Fotografia própria do portal"],
     ["Empresas atendidas — Sebrae",clients,"Últimos três anos"]
    ].map(([name,m,note])=><div key={String(name)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
     <p className="text-xs font-bold uppercase leading-relaxed text-slate-500">{String(name)}</p>
     <p className="mt-3 break-words text-2xl font-extrabold sm:text-3xl">{m?fmt(m as SebraeMetric):"N/D"}</p>
     <p className="mt-2 text-xs text-slate-500">{(m as SebraeMetric|undefined)?.period} · {String(note)}</p>
    </div>)}
   </section>
   {diff!==null&&active&&<p className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-xs leading-relaxed text-brand-900">
    <strong>Conciliação de fontes:</strong> Sebrae {num.format(active.value)} ativos ({active.period}) e Receita Federal direta {num.format(cnpj!.kpis!.active)} ({cnpj!.reference}); diferença de {num.format(Math.abs(diff))} estabelecimentos. Os critérios e as datas de extração não foram harmonizados; não interpretar como abertura ou baixa.
   </p>}
   <section className="grid min-w-0 gap-4 lg:grid-cols-2">
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
     <h2 className="font-bold">Evolução de vínculos — RAIS</h2><p className="mt-1 text-xs text-slate-500">Histórico público 2024–2025, vínculos formais</p>
     <div className="mt-4 h-[240px]" role="img" aria-label="Evolução anual RAIS em Canoas">
      <ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid vertical={false} stroke="#e5ebef"/><XAxis dataKey="year"/><YAxis width={65}/><Tooltip formatter={v=>num.format(Number(v))}/><Line dataKey="workers" stroke="#087f66" strokeWidth={3} name="Vínculos" dot={{r:4}}/></LineChart></ResponsiveContainer>
     </div>
    </div>
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
     <h2 className="font-bold">Remuneração nominal — RAIS</h2><p className="mt-1 text-xs text-slate-500">Média mensal, sem deflator</p>
     <div className="mt-4 h-[240px]" role="img" aria-label="Remuneração média nominal RAIS em Canoas">
      <ResponsiveContainer width="100%" height="100%"><BarChart data={trend}><CartesianGrid vertical={false} stroke="#e5ebef"/><XAxis dataKey="year"/><YAxis width={65}/><Tooltip formatter={v=>brl.format(Number(v))}/><Bar dataKey="wage" name="R$/mês" fill="#087f66" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
     </div>
    </div>
   </section>
   <section className="grid min-w-0 gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
    <nav className="min-w-0" aria-label="Temas de desenvolvimento econômico">
     <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
      {themes.map(item=><button key={item.id} onClick={e=>{setTheme(item.id);setQuery("");e.currentTarget.scrollIntoView({block:"nearest",inline:"start",behavior:"smooth"});}}
       aria-current={theme===item.id?"page":undefined}
       className={"min-w-[158px] shrink-0 rounded-xl border px-4 py-3 text-left text-sm font-semibold lg:w-full "+(theme===item.id?"border-brand-600 bg-brand-50 text-brand-900":"border-slate-200 bg-white text-slate-600")}>{item.label}</button>)}
     </div>
    </nav>
    <div className="min-w-0 space-y-4">
     <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-extrabold">{chosen?.label}</h2><p className="mt-1 text-xs text-slate-500">{chosen?.desc}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
       <label className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5"><Search size={16} className="text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar indicadores" className="min-w-0 flex-1 text-sm outline-none" aria-label="Buscar indicador no tema"/></label>
       <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/> Incluir arquivo histórico</label>
      </div>
      <p className="mt-3 text-xs text-slate-500">{filtered.length} indicadores · {source.filter(x=>x.theme===theme).length} da coleta estruturada recente</p>
     </div>
     {chosen?.href&&<Link href={chosen.href} className="flex items-start justify-between rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900"><span><strong>Explorar a fonte primária municipal</strong><span className="mt-1 block text-xs">Gráficos e dados complementares preservados no Canoas Empreende.</span></span><ArrowUpRight size={18}/></Link>}
     <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(m=><Card key={m.code} m={m} archived={historicalCodes.has(m.code)}/>)}</div>
     {!filtered.length&&<p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">Nenhum registro publicável para a seleção. Ausência não equivale a zero.</p>}
    </div>
   </section>
   <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
    <h2 className="flex items-center gap-2 text-sm font-bold text-amber-900"><ShieldAlert size={17}/> Limites de comparação e qualidade</h2>
    <p className="mt-2 text-xs leading-relaxed text-amber-900">RAIS, Receita Federal, Sebrae, INEP, Caged, MDIC, IBGE e SICONFI usam universos e competências próprios. O arquivo de fatos narrativos tem referência fixa de 18/10/2026.</p>
    <ul className="mt-3 list-disc space-y-2 pl-5 text-xs text-amber-900">{doc.quality.limits.map((l,i)=><li key={i}><strong>{l.topic}:</strong> {l.reason}</li>)}</ul>
   </section>
   <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="font-bold">Metadados e proveniência</h2>
    <p className="mt-2 text-xs leading-relaxed text-slate-600">Coleta estruturada: {doc.generatedAt?new Date(doc.generatedAt).toLocaleString("pt-BR"):"não informada"}. Fatos arquivados: 18/10/2026. Não são reproduzidas imagens nem visualizações originais de terceiros.</p>
    <ul className="mt-3 list-disc space-y-2 pl-5 text-xs text-slate-600">{doc.quality.notes.map((n,i)=><li key={i}>{n}</li>)}</ul>
    <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-700 underline">Perfil original — Observatório Sebrae Canoas <ExternalLink size={15}/></a>
   </section>
  </>}
 </main>;
}
