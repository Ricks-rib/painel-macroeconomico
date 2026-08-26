import { Navigate, Route, Routes } from 'react-router-dom';
import { AssistantPage } from '@/pages/AssistantPage';
import {
  EconomicActivityPage,
  ExchangeRatePage,
  InflationPage,
  InterestRatesPage,
} from '@/pages/CategoryPages';
import { OverviewPage } from '@/pages/OverviewPage';
import { SettingsPage } from '@/pages/SettingsPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<OverviewPage />} />
      <Route path="/juros" element={<InterestRatesPage />} />
      <Route path="/inflacao" element={<InflationPage />} />
      <Route path="/cambio" element={<ExchangeRatePage />} />
      <Route path="/atividade" element={<EconomicActivityPage />} />
      <Route path="/assistente" element={<AssistantPage />} />
      <Route path="/configuracoes" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
