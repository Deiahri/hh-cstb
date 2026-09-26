import { type ReactNode, useEffect, useState } from "react";
import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { type AppData, DataContext, loadAppData } from "./lib/data";
import { DICTS, type Lang, LangContext, initialLang, persistLang, useT } from "./lib/i18n";
import Lookup from "./pages/Lookup";
import Packet from "./pages/Packet";
import Overview from "./pages/Overview";
import Corridors from "./pages/Corridors";

/** The Overview and Corridors pages are for City and HISD staff and stay in English; say so in Spanish. */
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
      <HashRouter>
        <header className="topbar no-print">
          <NavLink to="/" className="brand">{t.brand}</NavLink>
          <nav>
            <NavLink to="/" end>{t.nav.check}</NavLink>
            <NavLink to="/zones">{t.nav.zones}</NavLink>
            <NavLink to="/corridors">{t.nav.corridors}</NavLink>
          </nav>
          <button
            type="button"
            className="button lang-toggle"
            lang={lang === "en" ? "es" : "en"}
            title={t.langToggleTitle}
            onClick={() => setLang(lang === "en" ? "es" : "en")}
          >
            {t.langToggle}
          </button>
        </header>
        {t.unreviewed && <p className="lang-banner no-print">{t.unreviewed}</p>}
        <main>
          {error && <div className="page"><p className="error">{error}</p></div>}
          {!data && !error && <div className="page"><p className="muted">{t.loading}</p></div>}
          {data && (
            <DataContext.Provider value={data}>
              <Routes>
                <Route path="/" element={<Lookup />} />
                <Route path="/packet" element={<Packet />} />
                <Route path="/zones" element={<EnglishOnly><Overview /></EnglishOnly>} />
                <Route path="/corridors" element={<EnglishOnly><Corridors /></EnglishOnly>} />
              </Routes>
            </DataContext.Provider>
          )}
        </main>
      </HashRouter>
    </LangContext.Provider>
  );
}
