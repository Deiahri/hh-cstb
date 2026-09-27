// The Walk Check shell: header, language, splash, and the routes. Screens and look follow the team's static Walk Check
// build (ui/, folded in here); the analysis is the app's own (src/lib/analyze.ts, shared with scripts/compute.ts).
import { useEffect, useState } from "react";
import { HashRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useParams, useSearchParams } from "react-router-dom";
import { WalkwayProvider } from "./lib/ai/walkway";
import { type AppData, DataContext, loadAppData } from "./lib/data";
import { DICTS, type Lang, LangContext, initialLang, persistLang } from "./lib/i18n";
import { UI } from "./lib/ui/strings";
import { ShareProvider } from "./components/ui/ShareSheet";
import Home, { NoZone, Pick, Prek } from "./pages/Home";
import WalkScreen from "./pages/Walk";
import { Bus, Help, SchoolZone } from "./pages/Requests";
import Zones, { Sources, ZonePage } from "./pages/Zones";
import { April15, Corridors, Data, Draft } from "./pages/Staff";
import Packet from "./pages/Packet";

const STAFF = ["/data", "/corridors", "/april15", "/draft"];

function Header({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const L = UI[lang];
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(scrollY > 4);
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);
  const staff = STAFF.some((p) => pathname.startsWith(p));
  return (
    <header className={`top${scrolled ? " is-scrolled" : ""}`} id="top">
      <Link className="brand" to="/" aria-label="Walk Check home">
        <svg width="28" height="28" aria-hidden="true"><use href="#logo" /></svg>
        <span>Walk Check</span>
      </Link>
      <nav className="topnav" aria-label="Site">
        <NavLink to="/zones">{L.nav_schools}</NavLink>
        <Link to="/data" aria-current={staff ? "page" : undefined}>{L.nav_staff}</Link>
      </nav>
      <div className="lang" role="group" aria-label="Language">
        {(["en", "es"] as Lang[]).map((l) => (
          <button key={l} type="button" className={`lang-btn${lang === l ? " is-on" : ""}`} aria-pressed={lang === l} onClick={() => setLang(l)}>
            {l === "en" ? "English" : "Español"}
          </button>
        ))}
      </div>
    </header>
  );
}

/** First visit only: offer the other language, for twelve seconds. */
function LangBar({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [state, setState] = useState<"off" | "in" | "out">(() => {
    try {
      if (localStorage.getItem("lang") || sessionStorage.getItem("wc.langbar")) return "off";
      sessionStorage.setItem("wc.langbar", "1");
    } catch {
      return "off";
    }
    return "out";
  });
  useEffect(() => {
    if (state !== "out") return;
    const a = requestAnimationFrame(() => setState("in"));
    return () => cancelAnimationFrame(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (state !== "in") return;
    const t = setTimeout(() => setState("off"), 12000);
    return () => clearTimeout(t);
  }, [state]);
  if (state === "off") return null;
  const L = UI[lang], other: Lang = lang === "en" ? "es" : "en";
  return (
    <div className={`langbar${state === "in" ? " is-in" : ""}`} role="status">
      <span>{L.other_lang}</span>
      <button type="button" className="langbar-go" onClick={() => { setLang(other); setState("off"); }}>{L.other_go}</button>
      <button type="button" className="langbar-x" aria-label={L.dismiss} onClick={() => setState("off")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  );
}

/** The splash in index.html: once per session, gone once the data is in. */
function useSplash(ready: boolean) {
  useEffect(() => {
    const sp = document.getElementById("splash");
    if (!sp) return;
    let seen = false;
    try {
      seen = !!sessionStorage.getItem("wc.splash");
      sessionStorage.setItem("wc.splash", "1");
    } catch {
      /* show it */
    }
    if (seen) return sp.remove();
    if (!ready) return;
    const a = setTimeout(() => sp.classList.add("is-gone"), 1300);
    const b = setTimeout(() => sp.remove(), 1900);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [ready]);
}

/** /check links, shared while the site briefly had a separate check page, open the walk. */
function CheckRedirect() {
  const [params] = useSearchParams();
  return <Navigate to={`/walk?${params}`} replace />;
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

/** Old links keep working: /schools, /april-15, /plan and friends. */
function Redirect({ to }: { to: (p: Record<string, string | undefined>, q: string) => string }) {
  const params = useParams();
  const [q] = useSearchParams();
  return <Navigate to={to(params, q.toString())} replace />;
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = (l: Lang) => {
    setLangState(l);
    persistLang(l);
  };
  useEffect(() => {
    loadAppData().then(setData, (e) => setError(String(e)));
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useSplash(!!data || !!error);

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <HashRouter>
        <ScrollTop />
        <Header lang={lang} setLang={setLang} />
        <LangBar lang={lang} setLang={setLang} />
        <main id="app" className={`app${data ? "" : " is-loading"}`} tabIndex={-1}>
          {error && <section className="screen"><p className="err">{error}</p></section>}
          {!data && !error && <section className="screen"><p className="muted">{DICTS[lang].loading}</p></section>}
          {data && (
            <DataContext.Provider value={data}>
              <ShareProvider>
                <WalkwayProvider>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/pick" element={<Pick />} />
                    <Route path="/prek" element={<Prek />} />
                    <Route path="/check" element={<CheckRedirect />} />
                    <Route path="/walk" element={<WalkScreen />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/bus" element={<Bus />} />
                    <Route path="/schoolzone" element={<SchoolZone />} />
                    <Route path="/packet" element={<Packet />} />
                    <Route path="/nozone" element={<NoZone />} />
                    <Route path="/zones" element={<Zones />} />
                    <Route path="/zone/:nbr" element={<ZonePage />} />
                    <Route path="/sources" element={<Sources />} />
                    <Route path="/data" element={<Data />} />
                    <Route path="/corridors" element={<Corridors />} />
                    <Route path="/april15" element={<April15 />} />
                    <Route path="/draft/:nbr" element={<Draft />} />
                    <Route path="/schools" element={<Navigate to="/zones" replace />} />
                    <Route path="/schools/:nbr" element={<Redirect to={(p) => `/zone/${p.nbr}`} />} />
                    <Route path="/april-15" element={<Navigate to="/april15" replace />} />
                    <Route path="/april-15/:nbr" element={<Redirect to={(p) => `/draft/${p.nbr}`} />} />
                    <Route path="/plan" element={<Redirect to={(_, q) => `/walk?${q}`} />} />
                    <Route path="*" element={<Home />} />
                  </Routes>
                </WalkwayProvider>
              </ShareProvider>
            </DataContext.Provider>
          )}
        </main>
        {DICTS[lang].unreviewed && <p className="small muted unreviewed">{DICTS[lang].unreviewed}</p>}
      </HashRouter>
    </LangContext.Provider>
  );
}
