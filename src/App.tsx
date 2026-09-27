import { type ReactNode, useEffect, useState } from "react";
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { type AppData, DataContext, loadAppData } from "./lib/data";
import { DICTS, type Lang, LangContext, initialLang, persistLang, useT } from "./lib/i18n";
import { Logo, Splash } from "./components/WalkCheck";
import Home from "./pages/Home";
import WalkScreen, { Prek } from "./pages/Walk";
import { Bus, Help, SchoolZone } from "./pages/Ask";
import { SchoolDetail, Schools } from "./pages/Schools";
import Packet from "./pages/Packet";
import Plan from "./pages/Plan";
import Overview from "./pages/Overview";
import Corridors from "./pages/Corridors";
import April15 from "./pages/April15";

/** The Overview, Corridors and April 15 pages are for City and HISD staff and stay in English; say so in Spanish. */
function EnglishOnly({ children }: { children: ReactNode }) {
  const { t, setLang } = useT();
  return (
    <>
      {t.englishOnly && <p className="lang-banner" lang={t.htmlLang}>{t.englishOnly}</p>}
      {/* Everything inside, shared components included, renders in English. */}
      <LangContext.Provider value={{ lang: "en", setLang }}>
        <div lang="en">{children}</div>
      </LangContext.Provider>
    </>
  );
}

function Header() {
  const { lang, setLang, t } = useT();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`top no-print${scrolled ? " is-scrolled" : ""}`}>
      <Link className="brand" to="/" aria-label={t.wc.home}>
        <Logo className="on-green" />
        <span>{t.wc.brand}</span>
      </Link>
      <nav className="topnav" aria-label="Site">
        <NavLink to="/schools">{t.wc.nav.schools}</NavLink>
        <NavLink to="/april-15">{t.wc.nav.principals}</NavLink>
      </nav>
      <div className="lang" role="group" aria-label="Language / Idioma">
        {(["en", "es"] as Lang[]).map((l) => (
          <button key={l} type="button" lang={l} className={`lang-btn${lang === l ? " is-on" : ""}`} aria-pressed={lang === l} onClick={() => setLang(l)}>
            {l === "en" ? "English" : "Español"}
          </button>
        ))}
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useT();
  const s = t.wc.staffLinks;
  return (
    <footer className="site-foot no-print">
      <span className="mob-only"><Link to="/schools">{t.wc.nav.schools}</Link> · <Link to="/april-15">{t.wc.nav.principals}</Link></span>
      <span>{t.wc.staff}</span>
      <Link to="/zones">{s.zones}</Link>
      <Link to="/corridors">{s.corridors}</Link>
      <Link to="/april-15">{s.april15}</Link>
    </footer>
  );
}

/** New screen, top of the page. */
function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLangState] = useState<Lang>(initialLang);
  const t = DICTS[lang];
  const setLang = (l: Lang) => {
    setLangState(l);
    persistLang(l);
  };
  useEffect(() => {
    loadAppData().then(setData, (e) => setError(String(e)));
  }, []);
  useEffect(() => {
    document.documentElement.lang = t.htmlLang;
  }, [t.htmlLang]);

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <Splash ready={!!data || !!error} />
      <HashRouter>
        <ScrollTop />
        <Header />
        {t.unreviewed && <p className="lang-banner no-print">{t.unreviewed}</p>}
        <main>
          {error && <div className="page"><p className="error">{error}</p></div>}
          {!data && !error && <div className="page"><p className="muted">{t.loading}</p></div>}
          {data && (
            <DataContext.Provider value={data}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/prek" element={<Prek />} />
                <Route path="/walk" element={<WalkScreen />} />
                <Route path="/help" element={<Help />} />
                <Route path="/bus" element={<Bus />} />
                <Route path="/schoolzone" element={<SchoolZone />} />
                <Route path="/schools" element={<Schools />} />
                <Route path="/schools/:nbr" element={<SchoolDetail />} />
                <Route path="/packet" element={<Packet />} />
                <Route path="/plan" element={<Plan />} />
                <Route path="/zones" element={<EnglishOnly><Overview /></EnglishOnly>} />
                <Route path="/corridors" element={<EnglishOnly><Corridors /></EnglishOnly>} />
                <Route path="/april-15" element={<EnglishOnly><April15 /></EnglishOnly>} />
                <Route path="*" element={<Home />} />
              </Routes>
            </DataContext.Provider>
          )}
        </main>
        <Footer />
      </HashRouter>
    </LangContext.Provider>
  );
}
