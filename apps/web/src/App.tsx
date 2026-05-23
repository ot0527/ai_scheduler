import { Navigate, Route, Routes } from "react-router-dom";
import { SessionGate } from "@/components/auth/SessionGate";
import { AppLayout } from "@/components/layout/AppLayout";
import { HomePage } from "@/pages/HomePage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { PreferencesPage } from "@/pages/PreferencesPage";
import { LifeRoutinesPage } from "@/pages/LifeRoutinesPage";
import { FixedSchedulesPage } from "@/pages/FixedSchedulesPage";
import { GoalsPage } from "@/pages/GoalsPage";
import { GoalFormPage } from "@/pages/GoalFormPage";
import { GoalDetailPage } from "@/pages/GoalDetailPage";
import { GoalDecomposePage } from "@/pages/GoalDecomposePage";
import { AiSettingsPage } from "@/pages/AiSettingsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<SessionGate />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="goals/new" element={<GoalFormPage />} />
          <Route path="goals/:id" element={<GoalDetailPage />} />
          <Route path="goals/:id/decompose" element={<GoalDecomposePage />} />
          <Route path="settings/preferences" element={<PreferencesPage />} />
          <Route path="settings/routines" element={<LifeRoutinesPage />} />
          <Route path="settings/fixed" element={<FixedSchedulesPage />} />
          <Route path="settings/ai" element={<AiSettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
