import { createContext, useContext, useState, useCallback } from "react";

interface HelpContextType {
  helpEnabled: boolean;
  toggleHelp: () => void;
}

const HelpContext = createContext<HelpContextType>({
  helpEnabled: true,
  toggleHelp: () => {},
});

export function useHelp() {
  return useContext(HelpContext);
}

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [helpEnabled, setHelpEnabled] = useState(() => {
    try {
      const stored = sessionStorage.getItem("arutsok_help");
      if (stored === null) return true;
      return stored === "true";
    } catch {
      return true;
    }
  });

  const toggleHelp = useCallback(() => {
    setHelpEnabled(prev => {
      const next = !prev;
      try { sessionStorage.setItem("arutsok_help", String(next)); } catch {}
      return next;
    });
  }, []);

  return (
    <HelpContext.Provider value={{ helpEnabled, toggleHelp }}>
      {children}
    </HelpContext.Provider>
  );
}
