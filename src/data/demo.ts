import type { Business } from "@/types/establishment";

/**
 * Dados integralmente FICTÍCIOS. Não representam CNPJs,
 * endereços, estabelecimentos nem estatísticas municipais reais.
 * Coordenadas sintéticas utilizadas exclusivamente no protótipo.
 */
export const DEMO_REFERENCE = "2026-09-30";
export const SECTORS = [
  { code: "G", label: "Comércio" },
  { code: "C", label: "Indústria de transformação" },
  { code: "F", label: "Construção" },
  { code: "I", label: "Alojamento e alimentação" },
  { code: "M", label: "Atividades profissionais" },
  { code: "Q", label: "Saúde e serviços sociais" },
  { code: "J", label: "Informação e comunicação" },
  { code: "H", label: "Transporte e armazenagem" },
] as const;

const neighborhoods = [
  ["Centro", -51.1792, -29.9188],
  ["Marechal Rondon", -51.1750, -29.9086],
  ["Igara", -51.1587, -29.9029],
  ["Estância Velha", -51.1613, -29.9308],
  ["Mathias Velho", -51.1912, -29.8887],
  ["Niterói", -51.1960, -29.9464],
  ["Rio Branco", -51.1833, -29.9543],
  ["São José", -51.1498, -29.9355],
  ["Guajuviras", -51.1349, -29.9035],
  ["Harmonia", -51.1749, -29.8905],
] as const;
const divisions = ["47", "25", "43", "56", "69", "86", "62", "49"];
const names = [
  "Comércio Exemplo", "Oficina Demonstrativa", "Serviços Ilustrativos",
  "Ateliê Fictício", "Tecnologia Exemplo", "Empreendimento Modelo",
  "Consultoria Demonstrativa", "Soluções de Amostra",
];

export const DEMO_BUSINESSES: Business[] = Array.from({ length: 120 }, (_, index) => {
  const i = index + 1;
  const sectorIndex = (i * 7 + Math.floor(i / 5)) % SECTORS.length;
  const neighborhood = neighborhoods[(i * 3 + Math.floor(i / 8)) % neighborhoods.length];
  const year = 2024 + (i % 3);
  const month = (i * 5) % 9 + 1;
  const day = (i * 7) % 27 + 1;
  const status: Business["status"] = i % 9 === 0 ? "08" : "02";
  const inicio = [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
  return {
    id: "DEMO-" + String(i).padStart(4, "0"),
    nome: names[i % names.length] + " " + String(i).padStart(3, "0"),
    cnae: divisions[sectorIndex] + ".00-0",
    setor: SECTORS[sectorIndex].code,
    divisao: divisions[sectorIndex],
    porte: (i % 10 === 0 ? "05" : i % 4 === 0 ? "03" : "01") as Business["porte"],
    bairro: neighborhood[0],
    inicio,
    baixa: status === "08" ? "2026-0" + ((i % 9) + 1) + "-15" : undefined,
    status,
    mei: i % 5 < 2,
    simples: i % 4 < 3,
    longitude: neighborhood[1] + ((i * 13) % 19 - 9) * 0.00055,
    latitude: neighborhood[2] + ((i * 11) % 17 - 8) * 0.0006,
  };
});

export const NEIGHBORHOODS = neighborhoods.map(([name]) => name).sort((a, b) => a.localeCompare(b, "pt-BR"));
