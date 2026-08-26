import {
  Activity,
  DollarSign,
  LayoutDashboard,
  Landmark,
  MessageSquare,
  Settings,
  TrendingUp,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const GROUPS = [
  {
    label: 'Indicadores',
    items: [
      { to: '/', label: 'Visao Geral', icon: LayoutDashboard, end: true },
      { to: '/juros', label: 'Juros', icon: Landmark, end: false },
      { to: '/inflacao', label: 'Inflacao', icon: TrendingUp, end: false },
      { to: '/cambio', label: 'Cambio', icon: DollarSign, end: false },
      { to: '/atividade', label: 'Atividade e Credito', icon: Activity, end: false },
    ],
  },
  {
    label: 'Analise',
    items: [{ to: '/assistente', label: 'Assistente', icon: MessageSquare, end: false }],
  },
  {
    label: 'Sistema',
    items: [{ to: '/configuracoes', label: 'Configuracoes', icon: Settings, end: false }],
  },
] as const;

/**
 * Barra lateral em azul-marinho institucional.
 *
 * A cor forte fica na navegacao, nao na area de dados: o conteudo respira em
 * branco e os graficos ficam com a paleta validada, sem competir com a marca.
 */
export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col bg-primary text-white">
      <div className="px-5 py-5">
        <p className="text-sm font-semibold leading-tight">Painel Macroeconomico</p>
        <p className="mt-0.5 text-[11px] text-white/60">Banco Central do Brasil</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              {group.label}
            </p>

            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-white/15 font-medium text-white'
                          : 'text-white/70 hover:bg-white/10 hover:text-white',
                      )
                    }
                  >
                    <item.icon aria-hidden className="h-4 w-4 shrink-0" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-3">
        <p className="text-[10px] leading-relaxed text-white/40">
          Dados publicos do SGS/BCB. Uso informativo; nao constitui recomendacao de investimento.
        </p>
      </div>
    </aside>
  );
}
