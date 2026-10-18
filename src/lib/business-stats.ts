import { DEMO_REFERENCE, SECTORS } from "@/data/demo";
import type { Business, BusinessFilters } from "@/types/establishment";

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);

export function dateFloor(months: number, reference = DEMO_REFERENCE) {
  const date = new Date(reference + "T12:00:00Z");
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

export function filteredBusinesses(rows: Business[], f: BusinessFilters): Business[] {
  const start = f.period === "all" ? null : dateFloor(Number(f.period));
  const query = f.query.trim().toLocaleLowerCase("pt-BR");
  return rows.filter((item) =>
    (!start || item.inicio >= start) &&
    (!f.sector || item.setor === f.sector) &&
    (!f.porte || item.porte === f.porte) &&
    (!f.status || item.status === f.status) &&
    (!f.bairro || item.bairro === f.bairro) &&
    (!f.meiOnly || item.mei) &&
    (!query || (item.nome + " " + item.id).toLocaleLowerCase("pt-BR").includes(query))
  );
}

function countBy<T>(rows: T[], key: (value: T) => string) {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(key(row), (counts.get(key(row)) ?? 0) + 1));
  return [...counts].map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
}

export function businessStats(rows: Business[]) {
  const ativos = rows.filter((item) => item.status === "02");
  const baixas = rows.filter((item) => item.status === "08");
  const thisYear = DEMO_REFERENCE.slice(0, 4);
  const thisMonth = DEMO_REFERENCE.slice(0, 7);
  const abertasAno = rows.filter((item) => item.inicio.startsWith(thisYear)).length;
  const abertasMes = rows.filter((item) => item.inicio.startsWith(thisMonth)).length;
  const baixasAno = baixas.filter((item) => item.baixa?.startsWith(thisYear)).length;
  const mei = ativos.filter((item) => item.mei).length;
  const porSetor = countBy(ativos, (item) => {
    return SECTORS.find((sec) => sec.code === item.setor)?.label ?? item.setor;
  });
  const porPorte = countBy(ativos, (item) =>
    item.porte === "01" ? "Microempresa" : item.porte === "03" ? "Pequeno porte" : "Demais"
  );
  const porBairro = countBy(ativos, (item) => item.bairro);
  const mensal = Array.from({ length: 12 }, (_, index) => {
    const month = new Date(Date.UTC(2025, 9 + index, 1)).toISOString().slice(0, 7);
    const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" })
      .format(new Date(month + "-01T12:00:00Z"));
    return {
      mes: label,
      aberturas: rows.filter((item) => item.inicio.startsWith(month)).length,
      baixas: baixas.filter((item) => item.baixa?.startsWith(month)).length,
    };
  });
  return {
    total: rows.length,
    ativos: ativos.length,
    abertasAno,
    abertasMes,
    baixasAno,
    saldo: abertasAno - baixasAno,
    meiPercent: ativos.length ? (mei / ativos.length) * 100 : 0,
    porSetor,
    porPorte,
    porBairro,
    mensal,
  };
}
