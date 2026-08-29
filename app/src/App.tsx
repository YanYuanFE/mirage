import { Routes, Route } from "react-router-dom";
import Landing from "@/components/Landing";
import WalletApp from "@/components/WalletApp";
import Docs from "@/components/Docs";
import { useTheme } from "@/lib/theme";

export default function App() {
  const [theme, toggleTheme] = useTheme();

  return (
    <div className="grain relative min-h-screen overflow-x-hidden">
      <div className="haze" aria-hidden />
      <Routes>
        <Route path="/" element={<Landing theme={theme} onToggleTheme={toggleTheme} />} />
        <Route path="/app" element={<WalletApp theme={theme} onToggleTheme={toggleTheme} />} />
        <Route path="/docs" element={<Docs theme={theme} onToggleTheme={toggleTheme} />} />
      </Routes>
    </div>
  );
}
