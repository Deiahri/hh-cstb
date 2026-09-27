// The Walk Check shell: header, language, footer links, and the routes. Screens and look follow the team's static Walk Check
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
import Check from "./pages/Check";
import About from "./pages/About";
import { Bus, Help, SchoolZone } from "./pages/Requests";
import Zones, { Sources, ZonePage } from "./pages/Zones";
import { April15, Corridors, Data, Draft } from "./pages/Staff";
import Packet from "./pages/Packet";

const STAFF = ["/data", "/corridors", "/april15", "/draft"];

function Header({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <header className="top" id="top">
      <Link className="brand" to="/" aria-label="Walk Check">WALK CHECK</Link>
      <div className="lang" role="group" aria-label="Language">
        {(["en", "es"] as Lang[]).map((l) => (
          <button key={l} type="button" className={`lang-btn${lang === l ? " is-on" : ""}`} aria-pressed={lang === l} onClick={() => setLang(l)}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    </header>
  );
}

/** Every page links to the others: the parent check, the closed schools, the reading, the staff tools. */
function Footer({ lang }: { lang: Lang }) {
  const L = UI[lang];
  const { pathname } = useLocation();
  const staff = STAFF.some((p) => pathname.startsWith(p));
  return (
    <footer className="foot-nav no-print">
      <nav aria-label="Site">
        <NavLink to="/" end>{L.nav_check}</NavLink>
        <NavLink to="/zones">{L.nav_schools}</NavLink>
        <NavLink to="/about">{L.nav_about}</NavLink>
        <Link to="/data" aria-current={staff ? "page" : undefined}>{L.nav_staff}</Link>
      </nav>
    </footer>
  );
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
                    <Route path="/check" element={<Check />} />
                    <Route path="/walk" element={<WalkScreen />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/bus" element={<Bus />} />
                    <Route path="/schoolzone" element={<SchoolZone />} />
                    <Route path="/packet" element={<Packet />} />
                    <Route path="/nozone" element={<NoZone />} />
                    <Route path="/zones" element={<Zones />} />
                    <Route path="/zone/:nbr" element={<ZonePage />} />
                    <Route path="/sources" element={<Sources />} />
                    <Route path="/about" element={<About />} />
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
        <Footer lang={lang} />
        {DICTS[lang].unreviewed && <p className="small muted unreviewed">{DICTS[lang].unreviewed}</p>}
      </HashRouter>
    </LangContext.Provider>
  );
}
