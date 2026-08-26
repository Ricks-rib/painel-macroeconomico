import type { ScreenContext } from '@bcb/shared';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * O que o usuario esta vendo agora.
 *
 * Cada pagina registra aqui, depois que seus dados carregam, o recorte que
 * esta na tela. O assistente le esse registro no momento da pergunta e o envia
 * junto -- e o que permite perguntar "e isso ai, esta alto?" sem precisar
 * nomear o indicador.
 *
 * Sao os dados que JA foram buscados para desenhar a tela; registrar nao
 * dispara requisicao nenhuma.
 */

interface ScreenContextValue {
  context: ScreenContext | null;
  setContext: (context: ScreenContext | null) => void;
}

const Ctx = createContext<ScreenContextValue | null>(null);

export function ScreenContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<ScreenContext | null>(null);
  const value = useMemo(() => ({ context, setContext }), [context]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScreenContext(): ScreenContextValue {
  const context = useContext(Ctx);
  if (!context) throw new Error('useScreenContext precisa estar dentro de ScreenContextProvider');
  return context;
}

/**
 * Registra o recorte da pagina atual e o limpa ao sair.
 *
 * A limpeza importa: sem ela, sair de Cambio e abrir o assistente enviaria um
 * contexto que nao esta mais na tela -- e o assistente responderia sobre algo
 * que a pessoa nao esta mais vendo.
 */
export function useRegisterScreenContext(context: ScreenContext | null): void {
  const { setContext } = useScreenContext();

  // Serializa para comparar por valor: o objeto e remontado a cada render, e
  // compara-lo por referencia dispararia o efeito em todo ciclo.
  const serialized = context ? JSON.stringify(context) : null;

  useEffect(() => {
    setContext(serialized ? (JSON.parse(serialized) as ScreenContext) : null);
    return () => setContext(null);
  }, [serialized, setContext]);
}
