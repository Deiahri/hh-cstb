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
        <footer className="site-foot small muted">
          <p>{UI[lang].disc}</p>
          {DICTS[lang].unreviewed && <p>{DICTS[lang].unreviewed}</p>}
        </footer>
      </HashRouter>
    </LangContext.Provider>
  );
}
