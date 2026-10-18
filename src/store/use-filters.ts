import { create } from "zustand";
import type { BusinessFilters, MapMode } from "@/types/establishment";

export const INITIAL_FILTERS: BusinessFilters = {
  query: "",
  period: "all",
  sector: "",
  porte: "",
  status: "",
  bairro: "",
  meiOnly: false,
};

type FilterState = {
  filters: BusinessFilters;
  mapMode: MapMode;
  setFilter: <K extends keyof BusinessFilters>(key: K, value: BusinessFilters[K]) => void;
  setMapMode: (mode: MapMode) => void;
  clearFilters: () => void;
};

export const useFilters = create<FilterState>((set) => ({
  filters: { ...INITIAL_FILTERS },
  mapMode: "points",
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  setMapMode: (mode) => set({ mapMode: mode }),
  clearFilters: () => set({ filters: { ...INITIAL_FILTERS } }),
}));
