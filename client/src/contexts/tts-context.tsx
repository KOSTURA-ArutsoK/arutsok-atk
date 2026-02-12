import { createContext, useContext } from "react";
import { useTTS } from "@/hooks/use-tts";

interface TTSContextType {
  enabled: boolean;
  toggle: () => void;
  speak: (text: string, key?: string) => void;
  resetSpoken: (key: string) => void;
}

const TTSContext = createContext<TTSContextType>({
  enabled: true,
  toggle: () => {},
  speak: () => {},
  resetSpoken: () => {},
});

export function TTSProvider({ children }: { children: React.ReactNode }) {
  const tts = useTTS();
  return (
    <TTSContext.Provider value={tts}>
      {children}
    </TTSContext.Provider>
  );
}

export function useTTSContext() {
  return useContext(TTSContext);
}
