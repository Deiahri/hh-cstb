import { useUi } from "./bits";

/** A pedestrian walking in place on a moving sidewalk: the wait while the address and the route are checked. */
export function Walker({ size = 128 }: { size?: number }) {
  return (
    <svg className="walker" width={size} height={size} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" aria-hidden="true">
      <g className="walker-body">
        <circle cx="50" cy="16" r="8" fill="currentColor" stroke="none" />
        <line className="walker-arm back" x1="50" y1="34" x2="50" y2="56" />
        <line className="walker-leg back" x1="50" y1="58" x2="50" y2="86" />
        <line x1="50" y1="30" x2="50" y2="58" />
        <line className="walker-leg" x1="50" y1="58" x2="50" y2="86" />
        <line className="walker-arm" x1="50" y1="34" x2="50" y2="56" />
      </g>
      <line className="walker-ground" x1="4" y1="94" x2="96" y2="94" strokeWidth="4" strokeDasharray="12 10" />
    </svg>
  );
}

/** While a walking route is on its way: the screen waits here rather than show a verdict that may change. */
export function Checking() {
  const { L } = useUi();
  return (
    <section className="screen checking" aria-busy="true">
      <Walker />
      <p className="muted" role="status">{L.checking}</p>
    </section>
  );
}
