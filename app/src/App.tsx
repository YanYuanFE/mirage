import { useEffect, useState } from "react";
import Landing from "@/components/Landing";
import WalletApp from "@/components/WalletApp";
import { useTheme } from "@/lib/theme";

type View = "landing" | "app";

function viewFromHash(): View {
  return window.location.hash === "#/app" ? "app" : "landing";
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [view, setView] = useState<View>(viewFromHash);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (v: View) => {
    window.location.hash = v === "app" ? "#/app" : "#/";
    window.scrollTo(0, 0);
  };

  return (
    <div className="grain relative min-h-screen overflow-x-hidden">
      <div className="haze" aria-hidden />
      {view === "landing" ? (
        <Landing theme={theme} onToggleTheme={toggleTheme} onLaunch={() => go("app")} />
      ) : (
        <WalletApp theme={theme} onToggleTheme={toggleTheme} onHome={() => go("landing")} />
      )}
    </div>
  );
}
