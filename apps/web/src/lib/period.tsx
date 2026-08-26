import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Janela de tempo compartilhada entre as paginas.
 *
 * Fica no contexto, e nao em cada pagina, porque trocar de aba nao deveria
 * jogar fora o recorte que a pessoa acabou de escolher: quem olha o cambio em
 * 90 dias quer ver a inflacao nos mesmos 90 dias.
 */

export const PERIOD_OPTIONS = [
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
  { days: 180, label: '6 meses' },
  { days: 365, label: '12 meses' },
  { days: 1095, label: '3 anos' },
] as const;

export type PeriodDays = (typeof PERIOD_OPTIONS)[number]['days'];

interface PeriodContextValue {
  days: PeriodDays;
  setDays: (days: PeriodDays) => void;
}

const PeriodContext = createContext<PeriodContextValue | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [days, setDays] = useState<PeriodDays>(365);
  const value = useMemo(() => ({ days, setDays }), [days]);

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodContextValue {
  const context = useContext(PeriodContext);
  if (!context) throw new Error('usePeriod precisa estar dentro de PeriodProvider');
  return context;
}
