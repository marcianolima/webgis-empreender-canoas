"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useMemo,useRef,useState} from "react";
import {
  BarChart3,BookOpen,BriefcaseBusiness,ChevronDown,ChevronRight,Database,
  ExternalLink,FileText,Globe2,Hexagon,Home,Landmark,Layers3,
  MapPinned,Menu,Network,SearchCheck,TrendingUp,X,type LucideIcon
} from "lucide-react";

type NavItem={href:string;label:string;icon:LucideIcon};
type NavGroup={id:string;label:string;icon:LucideIcon;items:NavItem[]};

const groups:NavGroup[]=[
 {id:"territorio",label:"Território e mapas",icon:MapPinned,items:[
  {href:"/#mapa",label:"Território de Canoas",icon:Globe2},
  {href:"/bairros",label:"Mapa econômico",icon:MapPinned},
  {href:"/territorio",label:"Inteligência territorial",icon:Layers3},
  {href:"/hex500",label:"Hexágonos e calor",icon:Hexagon}
 ]},
 {id:"economia",label:"Empresas e indicadores",icon:BriefcaseBusiness,items:[
  {href:"/cnpj",label:"Empresas CNPJ",icon:BriefcaseBusiness},
  {href:"/setores",label:"Setores econômicos",icon:BarChart3},
  {href:"/trabalho",label:"Emprego e exportações",icon:TrendingUp},
  {href:"/redesim",label:"REDESIM",icon:Network},
  {href:"/#rs",label:"Contexto estadual · RS",icon:Landmark}
 ]},
 {id:"sebrae",label:"Análises Sebrae",icon:SearchCheck,items:[
  {href:"/sebrae",label:"Panorama Sebrae",icon:BarChart3},
  {href:"/sebrae/series",label:"Séries e comparativos",icon:TrendingUp},
  {href:"/sebrae/consulta",label:"Consulta de indicadores",icon:SearchCheck}
 ]},
 {id:"apoio",label:"Fontes e metodologia",icon:BookOpen,items:[
  {href:"/fontes",label:"Fontes de dados",icon:Database},
  {href:"/sobre",label:"Sobre e metodologia",icon:FileText},
  {href:"/atualizacao",label:"Atualização dos dados",icon:Database}
 ]}
];

const titles:Record<string,string>={
 "/":"Painel geral",
 "/cnpj":"Empresas CNPJ",
 "/bairros":"Mapa econômico de bairros",
 "/territorio":"Inteligência territorial",
 "/hex500":"Hexágonos e calor",
 "/setores":"Setores econômicos",
 "/trabalho":"Emprego e exportações",
 "/redesim":"REDESIM",
 "/sebrae":"Panorama Sebrae",
 "/sebrae/series":"Séries e comparativos",
 "/sebrae/consulta":"Consulta de indicadores",
 "/fontes":"Fontes de dados",
 "/sobre":"Sobre e metodologia",
 "/atualizacao":"Atualização dos dados"
};

type HeaderAction={href:string;label:string;icon:LucideIcon};
const headerActions:Record<string,HeaderAction>={
 "/cnpj":{href:"/bairros",label:"Mapa econômico",icon:MapPinned},
 "/bairros":{href:"/territorio",label:"Análise comparativa",icon:Layers3},
 "/territorio":{href:"/hex500",label:"Hexágonos e calor",icon:Hexagon},
 "/hex500":{href:"/bairros",label:"Mapa econômico",icon:MapPinned},
 "/sebrae":{href:"/sebrae/series",label:"Séries históricas",icon:TrendingUp},
 "/sebrae/series":{href:"/sebrae/consulta",label:"Consulta ao vivo",icon:SearchCheck},
 "/sebrae/consulta":{href:"/sebrae/series",label:"Séries históricas",icon:TrendingUp}
};
const github="https://github.com/marcianolima/webgis-empreender-canoas";

function currentGroup(pathname:string):string|undefined{
 return groups.find(g=>g.items.some(item=>item.href.split("#")[0]===pathname&&pathname!=="/"))?.id;
}

export function SiteShell({children}:{children:React.ReactNode}){
 const pathname=usePathname();
 const [hash,setHash]=useState("");
 const [opened,setOpened]=useState<Record<string,boolean>>({territorio:true});
 const [drawerOpen,setDrawerOpen]=useState(false);
 const closeButton=useRef<HTMLButtonElement>(null);
 // Next.js static export uses trailingSlash; normalize router paths for
 // header shortcuts and selected sidebar links on GitHub Pages.
 const configuredBase=process.env.NEXT_PUBLIC_BASE_PATH||"";
 const routerPath=pathname||"/";
 const pathnameWithoutBase=configuredBase&&routerPath.startsWith(configuredBase+"/")
  ?routerPath.slice(configuredBase.length):routerPath;
 const locationPath=pathnameWithoutBase.replace(/\/+$/,"")||"/";
 const groupForPage=useMemo(()=>currentGroup(locationPath),[locationPath]);
 const contextAction=headerActions[locationPath];

 useEffect(()=>{
  const sync=()=>setHash(window.location.hash);
  sync();
  window.addEventListener("hashchange",sync);
  return ()=>window.removeEventListener("hashchange",sync);
 },[locationPath]);
 useEffect(()=>{
  // Preserve manually expanded menus; always expose the selected page's group.
  if(groupForPage)setOpened(prev=>({...prev,[groupForPage]:true}));
  setDrawerOpen(false);
 },[groupForPage,locationPath]);
 useEffect(()=>{
  if(!drawerOpen)return;
  const previous=document.body.style.overflow;
  document.body.style.overflow="hidden";
  closeButton.current?.focus();
  const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setDrawerOpen(false);};
  window.addEventListener("keydown",onKey);
  return ()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",onKey);};
 },[drawerOpen]);

 const active=(href:string)=>{
  const [route,fragment]=href.split("#");
  if(fragment)return locationPath===(route||"/")&&hash==="#"+fragment;
  return locationPath===href;
 };
 const go=()=>setDrawerOpen(false);
 const nav=(mode:"desktop"|"mobile")=><nav aria-label={mode==="desktop"?"Menu principal":"Menu principal móvel"} className="space-y-1">
   <Link href="/" onClick={go} aria-current={locationPath==="/"&&!hash?"page":undefined}
    className={"empreender-nav-item "+(locationPath==="/"&&!hash?"empreender-nav-active":"")}>
    <Home size={17} aria-hidden="true"/><span>Geral</span>
   </Link>
   <p className="px-3 pb-1 pt-5 text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">Explorar informações</p>
   {groups.map(group=>{
    const Icon=group.icon;
    const expanded=!!opened[group.id];
    const selected=group.items.some(item=>active(item.href));
    return <section key={group.id} aria-label={group.label} className="min-w-0">
     <button type="button" aria-expanded={expanded} aria-controls={"nav-"+mode+"-"+group.id}
      onClick={()=>setOpened(prev=>({...prev,[group.id]:!prev[group.id]}))}
      className={"empreender-nav-item w-full "+(selected?"text-white":"")}>
      <Icon size={17} aria-hidden="true"/><span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
      {expanded?<ChevronDown size={15} aria-hidden="true"/>:<ChevronRight size={15} aria-hidden="true"/>}
     </button>
     {expanded&&<div id={"nav-"+mode+"-"+group.id} className="space-y-0.5 pb-1 pl-5">
      {group.items.map(item=>{
       const ItemIcon=item.icon;
       return <Link key={item.href} href={item.href} onClick={go}
        aria-current={active(item.href)?"page":undefined}
        className={"empreender-nav-item empreender-nav-subitem "+(active(item.href)?"empreender-nav-active":"")}>
        <ItemIcon size={15} aria-hidden="true"/><span className="min-w-0 truncate">{item.label}</span>
       </Link>;
      })}
     </div>}
    </section>;
   })}
  </nav>;

 return <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
  <a href="#conteudo" className="sr-only focus:fixed focus:left-3 focus:top-2 focus:z-[90] focus:not-sr-only focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-ink">
   Ir para o conteúdo
  </a>
  <aside className="sticky top-0 hidden h-screen min-h-0 flex-col overflow-y-auto bg-[#102d43] px-3 pb-4 pt-5 text-white lg:flex" aria-label="Barra lateral">
   <Link href="/" className="flex items-center gap-3 px-2 pb-4" aria-label="Canoas Empreende · Geral">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-xl font-extrabold text-white">C</span>
    <span className="min-w-0"><strong className="block text-[16px] font-extrabold tracking-tight">Canoas Empreende</strong>
     <small className="mt-1 block text-[10px] font-bold tracking-[.15em] text-[#b4cfdb]">OBSERVATÓRIO · RS</small></span>
   </Link>
   <div className="min-h-0 flex-1">{nav("desktop")}</div>
   <p className="mt-6 border-t border-[#315062] px-2 pt-4 text-[11px] leading-relaxed text-[#b4cfdb]">
    Inteligência territorial e econômica com dados públicos oficiais.
   </p>
  </aside>
  <div className="min-w-0">
   <header className="sticky top-0 z-50 flex h-[58px] min-w-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-3 shadow-sm backdrop-blur-sm sm:px-6" aria-label="Cabeçalho do observatório">
    <div className="flex min-w-0 items-center gap-3">
     <button type="button" onClick={()=>setDrawerOpen(true)} aria-label="Abrir menu principal" aria-expanded={drawerOpen}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-ink lg:hidden">
      <Menu size={20} aria-hidden="true"/>
     </button>
     <Link href="/" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 font-black text-white lg:hidden" aria-label="Canoas Empreende · Geral">C</Link>
     <div className="min-w-0">
      <p className="hidden text-[9px] font-bold uppercase tracking-[.13em] text-brand-700 sm:block">Observatório territorial · Canoas / RS</p>
      <p className="truncate text-sm font-extrabold tracking-tight text-ink sm:text-base">{titles[locationPath]||"Canoas Empreende"}</p>
     </div>
    </div>
    <div className="flex shrink-0 items-center gap-2">
     {contextAction&&<Link href={contextAction.href} title={contextAction.label}
       aria-label={contextAction.label}
       className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 text-xs font-bold text-brand-700 hover:bg-brand-100 sm:px-3">
       <contextAction.icon size={15} aria-hidden="true"/><span className="hidden md:inline">{contextAction.label}</span>
      </Link>}
     <a href={github} target="_blank" rel="noopener noreferrer" aria-label="Código do projeto no GitHub"
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-brand-700 hover:bg-brand-50 sm:px-3">
      <span className="hidden sm:inline">GitHub</span><ExternalLink size={15} aria-hidden="true"/>
     </a>
    </div>
   </header>
   <div className="min-w-0">{children}</div>
  </div>
  {drawerOpen&&<div className="fixed inset-0 z-[70] lg:hidden">
   <button type="button" className="absolute inset-0 bg-slate-950/55" aria-label="Fechar menu" onClick={()=>setDrawerOpen(false)}/>
   <div role="dialog" aria-modal="true" aria-label="Navegação do observatório" className="absolute bottom-0 left-0 top-0 flex w-[min(88vw,340px)] flex-col bg-[#102d43] px-3 pb-4 pt-4 text-white shadow-2xl">
    <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#315062] px-2 pb-4">
     <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-lg font-black">C</span><strong className="text-sm">Canoas Empreende</strong></div>
     <button ref={closeButton} type="button" onClick={()=>setDrawerOpen(false)} aria-label="Fechar menu principal"
      className="rounded-lg p-2 text-white hover:bg-[#244b61]"><X size={19}/></button>
    </div>
    <div className="min-h-0 overflow-y-auto pb-8">{nav("mobile")}</div>
   </div>
  </div>}
 </div>;
}
