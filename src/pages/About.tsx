// About: for readers, judges and staff. The parent flow stays on / and /check; the long reading lives here and one click away.
import { Link } from "react-router-dom";
import { useUi } from "../components/ui/bits";

export default function About() {
  const { L } = useUi();
  const links: [string, string][] = [
    ["/zones", L.closed],
    ["/data", "Closed zones data"],
    ["/corridors", "Corridors"],
    ["/april15", "Before April 15"],
    ["/sources", L.sources_h],
  ];
  return (
    <section className="screen narrow about">
      <h1>{L.about_h}</h1>
      <ul className="facts-list">{L.about_b.map((b: string) => <li key={b}>{b}</li>)}</ul>
      <h2>{L.about_links}</h2>
      <nav className="linklist" aria-label={L.about_links}>
        {links.map(([to, label]) => <Link key={to} to={to}>{label} <span aria-hidden="true">→</span></Link>)}
      </nav>
    </section>
  );
}
