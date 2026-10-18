#!/usr/bin/env python3
"""Discover published public Sebrae Tesseract cubes and municipality dimensions."""
import concurrent.futures, json, re, urllib.request, urllib.parse
BASE="https://apiv2-observatorio.sebrae.com.br/tesseract"
def grab(path, params=None, timeout=25):
    u=BASE+path+("?"+urllib.parse.urlencode(params) if params else "")
    with urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0 CanoasEmpreende/1.1","Accept":"application/json","Accept-Encoding":"identity"}),timeout=timeout) as r:
        return json.loads(r.read(20_000_000))
def dims(c):
    out=[]
    for d in c.get("dimensions",[]):
        levels=[l.get("name") for h in d.get("hierarchies",[]) for l in h.get("levels",[])]
        out.append((d.get("name"),levels[-12:]))
    return out
def measures(c):
    return [m["name"] for m in c.get("measures",[])]
def main():
    probeurl=BASE+"/data.jsonrecords?cube=RAIS_workers&drilldowns=Year&measures=Workers&Municipality=4304606&Active%20worker%20indicator=1&Year=2025"
    for origin in ("https://marcianolima.github.io", "https://observatorio.sebrae.com.br"):
        try:
            req=urllib.request.Request(probeurl,headers={"Origin":origin,"User-Agent":"Mozilla/5.0"})
            with urllib.request.urlopen(req,timeout=12) as resp:
                print("CORS",origin,resp.status,"allow-origin",resp.headers.get("Access-Control-Allow-Origin"),"credentials",resp.headers.get("Access-Control-Allow-Credentials"),flush=True)
        except Exception as e:print("CORS_ERROR",origin,repr(e),flush=True)
    a=grab("/cubes")
    cubes=a.get("cubes",[]) if isinstance(a,dict) else a
    print("TOTAL_CUBES",len(cubes),flush=True)
    print("ALL_CUBE_NAMES",[(c["name"],(c.get("annotations") or {}).get("source_name")) for c in cubes],flush=True)
    keywords=("RAIS","RF","CAGED","COMEX","MDIC","SICONFI","IBGE","INEP","MDS","PAM","PPM","REDESIM","PNUD","SEBRAE","ANS","BACEN","CENSO","SALARIO","IDHM","VAB","DEMP","POP")
    relevant=[c for c in cubes if any(k in c["name"].upper() for k in keywords)]
    print("RELEVANT_CUBES",len(relevant),[(c["name"],(c.get("annotations") or {}).get("source_name")) for c in relevant],flush=True)
    targeted=["RAIS_workers","RAIS_establishment","RF"]
    targeted += [c["name"] for c in relevant if "CAGED" in c["name"].upper() or "SICONFI" in c["name"].upper() or "COMEX" in c["name"].upper() or "REDESIM" in c["name"].upper()]
    targeted += [c["name"] for c in relevant if "INEP_IDEB" in c["name"].upper() or "INEP_enem" in c["name"]]
    targeted += ["mdic_exp_imp_mun","MDS_PBF","IBGE","IBGE_PIB_Municipal_VAB",
       "INEP_censo","INEP_Censo_Ed_Basica","INEP_Censo_Taxas_Basica",
       "PNUD_Atlas_IDHM","IBGE_Censo_Pop_Sit","IBGE_Censo_Sexo_Faixa_Etaria",
       "Sebrae_Atendimento","Sebrae_Atendimento_2026","PAM Culturas",
       "PPM Produtos","PPM Efetivo dos Rebanhos","ANS_COB_PLANOS",
       "TSE_Perfil_Eleitorado","Sebrae_Bioeconomia"]
    targeted=list(dict.fromkeys(targeted))[:55]
    for c in cubes:
        if c["name"] in targeted:
            print("SCHEMA",c["name"],"MEASURES",measures(c),"DIMS",dims(c),"ANN",c.get("annotations"),flush=True)
    paths=[
      ("/data.jsonrecords",{"cube":"RAIS_workers","drilldowns":"Year,Active worker indicator","measures":"Workers","Municipality":"4304606","Year":"2025"}),
      ("/data.jsonrecords",{"cube":"RAIS_workers","drilldowns":"Year,Sex","measures":"Workers,Remuneration Avg Nominal","Municipality":"4304606","Year":"2025"}),
      ("/members",{"cube":"RAIS_workers","level":"Active worker indicator"}),
      ("/data.jsonrecords",{"cube":"RAIS_workers","drilldowns":"Year","measures":"Workers","Municipality":"4304606","Year":"2024,2025"}),
    ]
    def probe(v):
        try:
            j=grab(v[0],v[1],timeout=35)
            return ("SAMPLE",v[1],json.dumps(j,ensure_ascii=False)[:5000])
        except Exception as e:return ("SAMPLE_ERROR",v[1],repr(e))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as p:
        for item in p.map(probe,paths):print(*item,flush=True)
if __name__=="__main__":main()
