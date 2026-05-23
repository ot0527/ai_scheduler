import { NavLink, Navigate, Outlet } from "react-router-dom";
import {
  CalendarDays,
  Clock3,
  Home,
  Loader2,
  PieChart,
  Settings2,
  Sparkles,
  Target,
  Bot,
} from "lucide-react";
import { useSetupComplete } from "@/hooks/useScheduleData";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "ホーム", icon: Home, end: true },
  { to: "/budget", label: "時間予算", icon: PieChart },
  { to: "/goals", label: "目標", icon: Target },
  { to: "/settings/preferences", label: "基本設定", icon: Settings2 },
  { to: "/settings/routines", label: "生活リズム", icon: Sparkles },
  { to: "/settings/fixed", label: "固定予定", icon: CalendarDays },
  { to: "/settings/ai", label: "AI設定", icon: Bot },
];

export function AppLayout() {
  const { isComplete, isPending, isFetching, isFetched } = useSetupComplete();

  if (isPending || (isFetching && !isComplete)) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-notion-muted" />
      </div>
    );
  }

  if (!isComplete && isFetched) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!isComplete) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-notion-muted" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen">
      <aside className="hidden w-[240px] shrink-0 border-r border-notion-border bg-notion-sidebar md:flex md:flex-col">
        <div className="flex items-center gap-2 px-4 py-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-white text-sm shadow-sm">
            📅
          </div>
          <span className="text-sm font-semibold text-notion-text">
            AI秘書
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 px-2">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-[4px] px-3 py-2 text-sm text-notion-muted transition-colors",
                  isActive
                    ? "bg-notion-hover font-medium text-notion-text"
                    : "hover:bg-notion-hover hover:text-notion-text",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-notion-border bg-white px-4 py-3 md:hidden">
          <span className="text-sm font-semibold">AI秘書スケジュール</span>
          <Clock3 className="h-4 w-4 text-notion-muted" />
        </header>

        <main className="mx-auto w-full max-w-[900px] flex-1 px-4 py-8 md:px-10 md:py-10">
          <Outlet />
        </main>

        <nav className="flex border-t border-notion-border bg-white md:hidden">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-[11px]",
                  isActive ? "text-notion-accent" : "text-notion-muted",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
