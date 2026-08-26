import { CategoryView } from '@/components/common/CategoryView';

/**
 * As quatro areas do painel.
 *
 * Sao invocacoes do mesmo componente com textos diferentes -- a forma da tela e
 * identica, e duplicar o layout quatro vezes so criaria quatro lugares para a
 * proxima mudanca esquecer um.
 */

export function InterestRatesPage() {
  return (
    <CategoryView
      categoria="JUROS"
      title="Juros e Politica Monetaria"
      description="Meta Selic, Selic efetiva e CDI. Cada unidade tem seu proprio grafico: a meta e anual, a taxa efetiva e diaria."
    />
  );
}

export function InflationPage() {
  return (
    <CategoryView
      categoria="INFLACAO"
      title="Inflacao"
      description="IPCA no mes e acumulado em doze meses, com o IGP-M como contraponto."
    />
  );
}

export function ExchangeRatePage() {
  return (
    <CategoryView
      categoria="CAMBIO"
      title="Cambio"
      description="Dolar comercial, dolar PTAX e euro. Alta ou queda nao sao boas nem ruins em si -- dependem de quem exporta e de quem importa."
    />
  );
}

export function EconomicActivityPage() {
  return (
    <CategoryView
      categoria="ATIVIDADE"
      title="Atividade Economica e Credito"
      description="PIB mensal, estoque de credito do sistema financeiro e inadimplencia."
    />
  );
}
