// "Schools that closed": the seven zones before and after, one zone's page, and where the data comes from.
import { Fragment } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useData } from "../lib/data";
import { closedZones, mi, short } from "../lib/ui/model";
import { walkLink } from "../lib/ui/useUiWalk";
import { Back, BarRow, Legend, useUi } from "../components/ui/bits";
import { useShare } from "../components/ui/ShareSheet";
import { WcMap, usePhone } from "../components/ui/WcMap";
import { sampleLabel } from "./Home";

export default function Zones() {
  const d = useData();
  const { L } = useUi();
  const nav = useNavigate();
  const phone = usePhone();
  const zs = [...closedZones(d)].sort((a, b) => b.hazNew.combined - a.hazNew.combined);
  const T = d.totals;
  return (
    <section className="screen">
      <Back />
      <h1>{L.zones_h}</h1>
      <div className="cols side-first">
        <div className="col">
          <p className="small muted b">{L.shareof}</p>
          <Legend />
          <div className="bars">
            {zs.map((z) => (
              <BarRow key={z.nbr} label={short(z.name)} sub={`→ ${z.receiving.map((r) => short(r.name)).join(" / ")}`} before={z.hazOld.combined} now={z.hazNew.combined} onClick={() => nav(`/zone/${z.nbr}`)} />
            ))}
          </div>
          <p className="small muted">{L.pct_note}</p>
          {phone && <Link className="btn mob-only" to="/">{L.checkaddr}</Link>}
        </div>
        <div className="col side">
          <div className="stat">
            <span className="n">{Math.round(T.hazardNew.combined / 10)} {L.in10}</span>
            <span className="t">{L.big_t}</span>
            <span className="muted">{L.big_s(Math.round(T.hazardOld.combined / 10))}</span>
          </div>
          <WcMap kind="zones" height={phone ? 280 : 380} />
          {!phone && <Link className="btn desk-only" to="/">{L.checkaddr}</Link>}
        </div>
      </div>
    </section>
  );
}

export function ZonePage() {
  const d = useData();
  const { lang, L } = useUi();
  const share = useShare();
  const { nbr } = useParams();
  const zones = closedZones(d);
  const z = zones.find((x) => String(x.nbr) === nbr) ?? zones[0];
  const recv = z.receiving.map((r) => short(r.name)).join(" / ");
  const roads = z.pickupRoads.filter((p) => p.share >= 1);
  const site = `${location.origin}${location.pathname}`;
  return (
    <section className="screen">
      <Back />
      <h1 className="pair is-on"><span className="was">{short(z.name)}</span><span className="arrow" aria-hidden="true">→</span><span className="now">{recv}</span></h1>
      <div className="cols">
        <div className="col">
          <div className="stat warm">
            <span className="n">{z.hazNew.combined >= 95 ? L.all : `${Math.round(z.hazNew.combined / 10)} ${L.in10}`}</span>
            <span className="t">{L.zd_t}</span>
            <span className="muted">{L.zd_b(Math.round(z.hazOld.combined / 10))}</span>
          </div>
          <Legend />
          <div className="bars">
            <BarRow label={L.haz} before={z.hazOld.combined} now={z.hazNew.combined} />
            <BarRow label={L.railx} before={z.hazOld.rail} now={z.hazNew.rail} />
          </div>
          <dl className="facts">
            <div><dt>+{mi(z.medNewM - z.medOldM)} mi</dt><dd>{L.farther}</dd></div>
            <div><dt>{z.pctOver2New}%</dt><dd>{L.over2}</dd></div>
            <div><dt>{z.maxNewMi} mi</dt><dd>{L.longest}</dd></div>
          </dl>
          <h2>{L.pickup_h}</h2>
          <p>{L.pickup_b(z.name, z.address)}</p>
          <ul className="plain">
            {roads.length ? roads.map((p) => (
              <li key={p.name}>{p.name} <span className="muted">· {Math.round(p.share)}%{p.ped ? ` · ${L.tag_ped.toLowerCase()}` : ""}</span></li>
            )) : <li className="muted">{L.xnone}</li>}
          </ul>
          <p className="small muted">{L.pct_note}</p>
        </div>
        <div className="col side">
          <Link className="btn" to={walkLink(z.demo, sampleLabel(z.name, lang))}>{L.see}</Link>
          <Link className="btn secondary" to="/">{L.checkaddr}</Link>
          <button
            type="button"
            className="btn secondary"
            onClick={() => share(`${short(z.name)} → ${recv}: ${Math.round(z.hazNew.combined)}% of the old zone now walks across a dangerous road or train tracks, up from ${Math.round(z.hazOld.combined)}%. ${site}#/zone/${z.nbr}`, L.share_h)}
          >
            {L.share}
          </button>
          <dl className="def">
            {z.receiving.map((r) => (
              <Fragment key={r.name}><dt>{L.principal} · {r.name}</dt><dd>{L.front}<br />{r.address}</dd></Fragment>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

const SOURCES: [key: string, label: string][] = [
  ["schools_new", "HISD Schools 2026–27"],
  ["zones_old", "HISD elementary boundaries 2025–26"],
  ["zones_new", "HISD elementary boundaries 2026–27"],
  ["ped_hin", "City of Houston Vision Zero, pedestrian-dangerous roads (2022)"],
  ["hin", "City of Houston Vision Zero, High Injury Network (2022)"],
  ["rail", "Texas railroads, active (HISD map layer)"],
  ["signals", "Traffic signals (City, TxDOT, Harris County, via Houston TranStar)"],
  ["rail_crossings", "FRA crossing inventory, open public crossings, Harris County"],
  ["trainwatch", "Train Watch rail-crossing sensors (City of Houston)"],
  ["mtfp", "City of Houston Major Thoroughfare and Freeway Plan"],
  ["campus_grounds", "OpenStreetMap school grounds"],
];

export function Sources() {
  const d = useData();
  const { L } = useUi();
  const m = d.meta as unknown as Record<string, { label?: string; url?: string; readOn?: string; lastEditDate?: string | null; fetchedAt?: string } | undefined>;
  return (
    <section className="screen">
      <Back />
      <h1>{L.sources_h}</h1>
      <table className="tbl">
        <thead><tr>{L.src_cols.map((c: string) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {SOURCES.map(([k, label], i) => {
            const e = m[k] ?? {};
            return (
              <tr key={k}>
                <td><a href={e.url || "#"} target="_blank" rel="noopener">{e.label || label}</a></td>
                <td>{L.src_use[i]}</td>
                <td>{e.readOn || e.lastEditDate || (e.fetchedAt || "").slice(0, 10) || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="small muted">{L.pct_note} {L.note_lines}</p>
    </section>
  );
}
