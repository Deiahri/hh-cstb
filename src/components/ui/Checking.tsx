import { useUi } from "./bits";

/** While a walking route is on its way: the screen waits here rather than show a verdict that may change. */
export function Checking() {
  const { L } = useUi();
  return (
    <section className="screen" aria-busy="true">
      <p className="muted" role="status">{L.checking}</p>
    </section>
  );
}
