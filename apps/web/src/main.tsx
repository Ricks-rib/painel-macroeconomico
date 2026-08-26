import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { App } from './App';
import { ApiRequestError } from './lib/api';
import { PeriodProvider } from './lib/period';
import { ScreenContextProvider } from './lib/screen-context';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * Repetir so o que pode dar certo na segunda tentativa.
       *
       * 4xx e resposta definitiva do servidor -- uma serie que nao existe nao
       * vai passar a existir na terceira tentativa, e insistir apenas atrasa a
       * mensagem de erro que a pessoa precisa ver.
       */
      retry: (failureCount, error) => {
        if (error instanceof ApiRequestError && error.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: true,
    },
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('elemento #root nao encontrado');

/**
 * Roteador por alvo de build, e nao por preferencia.
 *
 * Em desenvolvimento e em qualquer servidor com fallback para o index, o
 * BrowserRouter da URLs limpas. A demonstracao estatica e servida por um host
 * de arquivos sem esse fallback: recarregar a pagina em /inflacao pediria um
 * arquivo que nao existe e devolveria 404. O HashRouter mantem a rota depois
 * do #, que o servidor nunca ve.
 *
 * A alternativa -- 404.html redirecionando para o index -- resolve o sintoma
 * fazendo o host mentir sobre o codigo de status.
 */
const Router = import.meta.env.VITE_DEMO === '1' ? HashRouter : BrowserRouter;

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <PeriodProvider>
          <ScreenContextProvider>
            <App />
          </ScreenContextProvider>
        </PeriodProvider>
      </Router>
    </QueryClientProvider>
  </StrictMode>,
);
