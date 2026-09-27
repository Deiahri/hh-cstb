// The family's confirmed walkway sentence (idea #3), shared by the bus request and the page for HISD while the tab is
// open. Memory only: it's about a child's walk from home, so it's never written to storage. It belongs to one home.
import { type ReactNode, createContext, useContext, useState } from "react";

type Held = { home: string; sentence: string } | null;
const Ctx = createContext<{ held: Held; set: (h: Held) => void }>({ held: null, set: () => {} });

export function WalkwayProvider({ children }: { children: ReactNode }) {
  const [held, set] = useState<Held>(null);
  return <Ctx.Provider value={{ held, set }}>{children}</Ctx.Provider>;
}

/** The sentence for this home (`lat,lng`), and a setter; null clears it. */
export function useWalkway(home: string): [string | null, (s: string | null) => void] {
  const { held, set } = useContext(Ctx);
  return [held?.home === home ? held.sentence : null, (s) => set(s ? { home, sentence: s } : null)];
}
