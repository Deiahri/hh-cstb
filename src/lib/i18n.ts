// Every sentence a family reads, in English and Spanish. Same pattern as the Eviction Help Plan build.
//
// Copy rules, enforced here rather than left to taste:
//   1. Neither side's voice. The page isn't HISD smoothing over the closures, and it isn't a protest against
//      them: "HISD's own rules, checked against your street." No "unfair," no "transition," no blame, no thanks.
//   2. Never say a family qualifies. The page gathers evidence; HISD decides.
//   3. Plain words, about a 6th-grade reading level. The answer first, detail after, legal cites inside <details>.
//   4. Never "safe" (nor "seguro/segura"). A light is "a traffic light," a rail crossing "has gates." Lead with where
//      to cross; crash and death counts stay inside <details>. Written for the adult who walks the child.
// The Overview, Corridors and April 15 pages are for City and HISD staff and stay in English; they say so in Spanish.
// The packet body stays in English because HISD staff read it; its instructions to the family are translated.
// The Spanish hasn't been reviewed by a professional translator, and the app says so whenever it's shown.

import { createContext, useContext } from "react";
import type { Dir, RailKind } from "./crossings";

export type Lang = "en" | "es";

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

const en = {
  htmlLang: "en",
  brand: "Closed-School Walk Check",
  nav: { check: "Check an address", zones: "Closed zones", corridors: "Corridors", april15: "Before April 15" },
  langToggle: "Español",
  langToggleTitle: "Ver esta página en español",
  loading: "Loading HISD and City maps…",
  unreviewed: "",
  englishOnly: "",

  lookup: {
    h1: "Check your child's walk to school",
    tagline: "HISD's own rules, checked against your street.",
    lede:
      "Seven HISD elementary schools closed after last school year. Type your home address. You'll see what your child's walk " +
      "crosses, like train tracks and the City's most dangerous roads, and get a page you can print or copy for HISD.",
    addrLabel: "Home address",
    addrPlaceholder: "Home address, like 1800 McCarty St",
    check: "Check",
    searching: "Searching…",
    orMap: "Or click your home on the map.",
    showMap: "Show the map",
    hideMap: "Hide the map",
    noMatch: "We couldn't find that address in Houston. Try adding the ZIP code, or pick your home on the map.",
    searchDown: "The address search isn't answering. Pick your home on the map instead.",
    tryZone: "Try a closed school's area:",
    samplePoint: (zone: string) => `Sample point in the old ${zone} area`,
    home: "Home",
    lastYear: (s: string) => `Last year's school: ${s}`,
    thisYear: (s: string) => `This year's school: ${s}`,
    stop: "Suggested stop",
    dragStop: "Suggested stop: drag me",
  },

  routing: {
    loading: "Finding a walking route. Showing a straight-line estimate for now.",
    unavailable: "Walking route unavailable. Dashed lines and listed hazards are straight-line estimates, not directions.",
    ready: "Estimated walking route · openrouteservice / OpenStreetMap contributors",
    distance: (x: string) => `${x} along the mapped walking route`,
    caveat: "Listed hazards are potential intersections on a flat map. Bridges, tunnels, sidewalks and access need checking; a nearby light is not a crossing instruction.",
    endpoints: (a: number, b: number) => `The mapped route starts ${a} m from the home pin and ends ${b} m from the campus pin. Access across these gaps is unverified and excluded from walking distance.`,
    endpoint: "Mapped walking route endpoint; connection to the pin is unverified",
    possible: "Potential intersections with listed roads or railroads:",
    noHits: "No intersections with the listed hazards were found in this geometry. Other hazards may exist.",
    control: (label: string, distance: string) => `Nearby control: ${label}, ${distance} in a straight line from the mapped intersection. A walking path to it has not been verified.`,
    noControl: "No nearby control found in the available data. Check local crossings and access.",
    comparison: "The two walks show different potential rail intersections. Confirm actual crossings locally.",
    distanceBasis: "The distance-rule estimate below still uses straight-line distance. Routed walking distance is shown separately; HISD decides eligibility.",
    mapNote: "Street geometry is shown when routing succeeds; dashed estimates are used when it fails. Endpoint circles mark the mapped network, not a verified entrance.",
  },

  result: {
    outside: "This spot is outside HISD's elementary school zones.",
    headlineClosed: (old: string, now: string) => `${old} closed. This home's elementary school is now ${now}.`,
    headlineOpen: (now: string) => `This home's elementary school is ${now}. Its school didn't close.`,
    wasLastYear: (was: string) => ` Last year it was ${was}.`,
    walkShuttle: (old: string) => `Walk to the shuttle at ${old}`,
    walkShuttleWhen: "Through the 2027–28 school year",
    walkDirect: (now: string) => `Walk directly to ${now}`,
    walkDirectWhen: "If you skip the shuttle, and for everyone after it ends",
    walkOnly: (now: string) => `Walk to ${now}`,
    miles: (x: string) => `about ${x} in a straight line`,
    crosses: (rail: boolean, roads: number) => {
      const parts = [rail && "train tracks", roads > 0 && plural(roads, "dangerous road", "dangerous roads")].filter(Boolean);
      return parts.length ? `Potential map intersections: ${parts.join(" and ")}.` : "No intersections with listed hazards found in this geometry.";
    },
    details: "See each road and track",
    shuttleAddsRail: (now: string) => `The walk to the shuttle crosses train tracks. Walking straight to ${now} doesn't.`,
    shuttleAvoidsRail: (now: string) => `Walking straight to ${now} crosses train tracks. The shuttle avoids them until it ends.`,
    cliff: (x: string, now: string) =>
      `The shuttle ends after the 2027–28 school year. Then HISD gives a bus only to students who live 2 miles or more from school. ` +
      `This home is about ${x} from ${now}, so it won't get a bus for distance. The other way to ask is a hazardous-route request, ` +
      `and this page gathers the evidence for it.`,
    under2: (x: string, now: string) =>
      `This home is about ${x} from ${now}, under 2 miles. HISD gives a bus for distance only at 2 miles or more. ` +
      `The other way to ask is a hazardous-route request, and this page gathers the evidence for it.`,
    over2: (x: string, now: string) =>
      `This home is about ${x} from ${now} in a straight line, 2 miles or more. HISD gives a bus to students who live that far, ` +
      `so ask the school about the regular bus first.`,
    distanceLabel: "Distance",
    cliffLabel: "When the shuttle ends",
    preK:
      "HISD's transportation page says Pre-K 3 and Pre-K 4 students don't get HISD bus service unless an IEP or 504 plan " +
      "includes it. Ask the school what help there is for Pre-K.",
    preKLabel: "Pre-K",
    railNote:
      "A news report on HISD's process (Houston Landing, December 2024) says that for elementary students, a walk across train " +
      "tracks counts as hazardous. Only HISD can decide.",
    railLabel: "Train tracks",
    shuttleTitle: "The closure shuttle",
    shuttleBody: (old: string, addr: string, dest: string) =>
      `HISD runs a bus from ${old} (${addr}) to ${dest} for any K–12 student affected by the closure, in 2026–27 and 2027–28. ` +
      `Your child still walks to ${old} to catch it.`,
    and: " and ",
    notPublished: "HISD hasn't published where on campus the shuttle stops or when it runs. Ask HISD's closure family line: 713-556-7121.",
    stopTitle: "Suggest a bus stop",
    stopBody:
      "HISD's hazardous-route form asks where a stop should go. The S pin starts at your home. Drag it to a corner on your side " +
      "of the tracks and busy roads.",
    resetStop: "Move it back to home",
    packetButton: "Get the page for HISD →",
    planButton: "Print a walk plan",
    sms: "Text this to me or family",
    smsBody: (addr: string, now: string, crosses: string, url: string) => `Walk check for ${addr}. Walk to ${now}: ${crosses} ${url}`,
  },

  hazard: {
    rail: "Train tracks (active)",
    ped: "Dangerous for people walking",
    hin: "High-injury road",
    railName: (company: string) => `Active railroad: ${company}`,
    counts: (c: number, d: number) =>
      `Where the line crosses it: ${plural(c, "crash", "crashes")} involving someone on foot, ${plural(d, "death", "deaths")}.`,
    whole: (miles: string, c: number, d: number) =>
      `Whole road on the City's list: ${miles} mi, ${plural(c, "crash", "crashes")} involving someone on foot, ${plural(d, "death", "deaths")}.`,
    none: "No train tracks and no road on the City's dangerous-road lists.",
  },

  cross: {
    dirs: { n: "north", ne: "northeast", e: "east", se: "southeast", s: "south", sw: "southwest", w: "west", nw: "northwest" } as Record<Dir, string>,
    railKinds: {
      underpass: "the street goes under the tracks",
      bridge: "the street goes over the tracks",
      path: "a crossing for people walking",
      gatesLights: "gates and flashing lights",
      gates: "gates",
      lights: "flashing lights",
      none: "no gates or lights",
    } as Record<RailKind, string>,
    atLight: (label: string, dist: string, dir: string) => `Cross at the traffic light at ${label}, ${dist} ${dir} of where the line meets the road.`,
    atLightHere: (label: string) => `Cross at the traffic light at ${label}. It's right where the line meets the road.`,
    atRail: (label: string, kind: string, dist: string, dir: string) => `Cross the tracks at ${label} (${kind}), ${dist} ${dir} of where the line meets them.`,
    atRailHere: (label: string, kind: string) => `Cross the tracks at ${label} (${kind}). It's right where the line meets them.`,
    adds: (x: string) => `That adds about ${x} to the walk.`,
    addsNothing: "That adds almost nothing to the walk.",
    noLight: (near: string) => `No traffic light on this road within ${near} of where the line crosses it.`,
    noRail: (near: string) => `No public rail crossing within ${near} of where the line meets the tracks.`,
    nearestLight: (label: string, dist: string, dir: string, adds: string) => `The nearest is at ${label}, ${dist} ${dir}. Crossing there adds about ${adds}.`,
    nearestRail: (label: string, kind: string, dist: string, dir: string, adds: string) =>
      `The nearest is ${label} (${kind}), ${dist} ${dir}. Crossing there adds about ${adds}.`,
    noneWithin: (far: string) => `There's none within ${far}.`,
    whoLabel: "Who can change this",
    whoRoad: (school: string) =>
      `The City. Ask the principal of ${school} to ask the City for a crossing guard here. If the street qualifies, the ` +
      `principal can also apply for a school zone (applications close April 15). You can report the crossing to the City through 311.`,
    // A local street that doesn't border the school can't get a City school zone (HPW), so don't offer one.
    whoRoadNoZone: (school: string) =>
      `The City. Ask the principal of ${school} to ask the City for a crossing guard here. You can also ask the City for a ` +
      `crosswalk or a traffic-signal study through 311. A school zone isn't an option on these streets under the City's rules.`,
    whoRail: "HISD decides where bus stops go. To ask about a walk across train tracks, use the page for HISD in this app.",
    crashSummary: "City crash counts",
    caveat:
      "Traffic lights only. Crossing guards, stop signs and marked crosswalks aren't on any public map, so a crossing with a " +
      "guard shows here as \"no traffic light.\" At a light, turning cars still cross your path.",
    pathAdds: (x: string) => `Crossing at every light and rail crossing named above adds about ${x} in all.`,
    lightTip: (label: string) => `Traffic light: ${label}`,
    railTip: (label: string, kind: string) => `Rail crossing: ${label} (${kind})`,
  },

  dates: (p: { rail: string; zones: string; schools: string; lights: string; xings: string }) =>
    `Data dates: City crash lists 2022 · HISD railroads ${p.rail} · attendance boundaries ${p.zones} · campus list ${p.schools} · ` +
    `traffic lights read ${p.lights} · rail crossings ${p.xings}.`,

  plan: {
    back: "← Back to the walk",
    print: "Print or save as PDF",
    eyebrow: "Walk plan",
    title: (school: string) => `Walk plan to ${school}`,
    forHome: (addr: string) => `For the home at ${addr}.`,
    first: "First: check the route, entrances and crossings locally before using it with your child.",
    walkShuttle: (old: string) => `Walk to the shuttle at ${old}, through the 2027–28 school year`,
    walkDirect: (now: string) => `Walk directly to ${now}`,
    walkOnly: (now: string) => `Walk to ${now}`,
    noCrossings:
      "This walk crosses no train tracks and no road on the City's dangerous-road lists. Walk it once anyway to see the corners.",
    doOnce: "Three things to do once",
    do1: "Check the route and actual crossing access before walking with your child.",
    do2Shuttle: (old: string) =>
      `While the shuttle runs (through 2027–28), ask the school or HISD's closure family line, 713-556-7121, where at ${old} it stops and when.`,
    do2: (now: string) => `Ask ${now} whether there's a crossing guard on your child's way, and where.`,
    do3: "Send HISD one request about the walk. The page for HISD in this app fills in the details for you.",
    mapNote: "Straight lines, not streets. The dotted blue-green line goes through the lights and crossings named above.",
    by: "Made from public HISD, City of Houston, Houston TranStar and federal railroad data. This isn't an HISD document.",
    missing: "This link has no usable home location.",
    start: "Start from an address",
  },

  legend: {
    aria: "Map legend",
    walkNow: "Walk to this year's school",
    walkOld: "Walk to the shuttle pickup, or last year's school",
    shuttle: "Closure shuttle, pickup to drop-off (HISD hasn't published exact stops or streets)",
    ped: "Road the City lists as dangerous for people walking (2022)",
    hin: "High-injury road (City of Houston, 2022)",
    rail: "Active train tracks (HISD map layer)",
    controls: "Nearby traffic light or public rail crossing (context only)",
    path: "Walk through the lights and crossings",
  },

  shuttleMap: {
    line: (from: string, to: string, miles: string) =>
      `Closure shuttle: ${from} → ${to}, ${miles} mi in a straight line. HISD hasn't published the streets it takes.`,
    dropOff: (name: string) => `Shuttle drop-off: ${name}`,
    exactSpot: (addr: string) => `${addr}. The exact spot isn't published.`,
    sameSite: (addr: string) => `Same building, ${addr}. No shuttle trip.`,
    pickup: (name: string) => `Shuttle pickup: ${name}`,
    closedOrMoved: "(closed or moved)",
    somewhere: (addr: string) => `${addr}. The stop is somewhere on this campus.`,
    to: "To: ",
  },

  notes: {
    title: "Good to know.",
    body:
      "Address pages use a walking route when available and label straight-line fallbacks. Street routes may cross different hazards. " +
      "This page gathers evidence. It doesn't decide who gets a bus. HISD does.",
    more: "More detail",
    law:
      "Texas's test for a hazardous walk (Tex. Educ. Code §48.151) also asks whether there's a sidewalk. Houston doesn't publish " +
      "sidewalk data, so that part has to come from the family.",
    area: "Percentages are shares of each zone's area, sampled on an even grid. They aren't counts of students or homes.",
    vintageSummary: (date: string) => `Where the data comes from · snapshot ${date}`,
    features: (n: string, date: string) => `${n} features, last edited ${date}`,
    unknown: "unknown",
    layers: {
      zones_old: "Elementary boundaries 2025–26",
      zones_new: "Elementary boundaries 2026–27",
      schools_old: "Campus points 2025–26",
      schools_new: "Campus points 2026–27",
      rail: "Active railroads (HISD)",
      ped_hin: "Ped Dangerous Roads (City, HIN 2022)",
      hin: "High Injury Network (City, 2022)",
    },
    grounds: "School grounds (OpenStreetMap contributors)",
    signals: "Traffic lights (City, TxDOT, Harris County, via Houston TranStar)",
    signalsCount: (n: string, date: string) => `${n} lights, read ${date}; the feed carries no date`,
    railXings: "Public rail crossings (FRA crossing inventory)",
    railXingsCount: (n: string, date: string) => `${n} crossings in Harris County, dataset updated ${date}`,
    mtfp: "Street class (City of Houston Major Thoroughfare and Freeway Plan)",
    centerline: "Road centerline (City of Houston)",
    layerEdited: (date: string) => `last edited ${date}`,
    groundsCount: (n: number, date: string) => `${n} outlines around the shuttle campuses, newest edit ${date}`,
    pairings: "Shuttle pairings:",
    pairingsTail: "HISD has published no stop locations, times or routes for the shuttles.",
    vintageNote:
      "Crash counts are from the City's 2022 High Injury Network, the newest the City publishes. The railroad layer was last " +
      "edited in 2024; track status may have changed.",
  },

  packet: {
    back: "← Back to the walk",
    print: "Print or save as PDF",
    howTitle: "How to send this to HISD",
    howIntro: "There are two ways. You can use both.",
    way1Title: "1. File it yourself online",
    way1Before: "Open HISD's ",
    way1Link: "Transportation Support Request Form",
    way1After:
      '. Choose "Walk Route Concerns." Paste the text below into the Description box. You\'ll need your child\'s student ID ' +
      "(an S and 7 numbers). The form can't take files, so also print this page and give it to the school office.",
    way2Title: "2. Ask the school to file it",
    way2: (school: string) =>
      `Give a printed copy to the principal of ${school}. Ask them to send HISD a hazardous-route request for your area. ` +
      `HISD's policy (CNA, Exhibit B) has the principal start that request.`,
    timing:
      "HISD's pages give 5 to 10 business days for transportation requests. They don't say how long a walk-route request takes. " +
      "Only HISD decides who gets a bus.",
    copyTitle: "Text to paste into the form",
    copyNote: "",
    addSidewalk:
      "Before you copy it, add a sentence at the end: is there a sidewalk, and where does your child cross? HISD's rule asks about " +
      "sidewalks, and no public map shows them.",
    copy: "Copy text",
    copied: "Copied",
    copyFailed: "Select the text and copy it.",
    printNote: "",
  },

  // Walk Check screens (from the Walk Check wireframes): one question or one answer per screen, phone first.
  wc: {
    brand: "Walk Check",
    home: "Walk Check home",
    nav: { schools: "Schools that closed", principals: "For principals" },
    staff: "For City and HISD staff:",
    staffLinks: { zones: "Closed zones data", corridors: "Corridors", april15: "Before April 15" },
    back: "Back",
    h1: "What does your child's walk to the new school cross?",
    lede: "Seven HISD elementary schools closed after last school year. Type your address. You'll see the dangerous roads and train tracks on your child's walk, where to cross them, and how to ask for a change.",
    addr: "Your home address",
    addrPlaceholder: "Street address, Houston, TX",
    check: "Check my walk",
    pickMap: "Pick my home on a map",
    hideMap: "Hide the map",
    mapHint: "Tap your home on the map.",
    tryZone: "Or try a spot in a closed school's area:",
    closed: "Schools that closed",
    see: "See it",
    pair: (from: string, to: string) => `${from} to ${to}`,
    prekQ: "Is your child in Pre-K?",
    prekWhy: "HISD's bus rules are different for Pre-K.",
    yes: "Yes", yesSub: "Pre-K 3 or Pre-K 4",
    no: "No", noSub: "Kindergarten to 5th grade",
    verdict: (to: string, rail: boolean, roads: number) => {
      const parts = [rail && "train tracks", roads > 0 && plural(roads, "dangerous road", "dangerous roads")].filter(Boolean);
      return parts.length
        ? `The mapped line to ${to} may intersect ${parts.join(" and ")}.`
        : `No listed hazard intersections were found on the mapped line to ${to}. Other hazards may exist.`;
    },
    lastYear: "Last year",
    now: "Now",
    closedTag: "closed",
    nCrossings: (n: number) => (n === 0 ? "no listed intersections found" : plural(n, "potential intersection", "potential intersections")),
    walk: "Potential intersections, in route order",
    walkAria: (steps: string) => `Schematic of potential intersections in route order, not directions: ${steps}`,
    home1: "Home",
    whereToCross: "Nearby crossing controls to check",
    shuttleTitle: "Closure shuttle, through the 2027–28 school year",
    shuttleWalk: (old: string) => `The walk to the shuttle at ${old}`,
    shuttleSame: "It crosses the same roads and tracks as last year's walk.",
    prekTitle: "HISD's bus rules leave out Pre-K",
    prekBody:
      "HISD's transportation page says Pre-K 3 and Pre-K 4 students don't get HISD bus service unless an IEP or 504 plan includes it. " +
      "The closure shuttle's announcement says K–12 and doesn't name Pre-K. Ask the principal what help there is.",
    showMap: "Show the map",
    mapAlt: "Map: original home and school pins, route geometry and potential hazard intersections",
    ask: "Ask for a change",
    askZone: "Ask for a school zone",
    print: "Print a walk plan",
    printShort: "Print",
    share: "Share",
    outside: "This spot is outside HISD's elementary school zones.",
    notClosed: "This address isn't in one of the seven closed zones.",
    zoned: "Zoned school",
    same: "Same as last year",
    was: (s: string) => `Last year: ${s}`,
    seeWalk: "Check this walking route",
    seeClosed: "See the schools that closed",
    another: "Try another address",
    know: (names: string) => `Know a family near ${names}?`,
    helpH1: "Two ways to ask for a change to this walk",
    helpSub: "The principal can send both. You can also file the first one yourself.",
    busH: "Ask HISD for a bus",
    busSub: "A hazardous-route request. HISD can add a bus stop when a walk crosses dangerous roads or train tracks. Only HISD decides.",
    zoneH: "Ask the City for a school zone",
    zoneSub: "A lower speed limit during school hours, with signs, on a street your child crosses. Only the principal can apply.",
    zoneNone:
      "Under the City's rules, none of the roads on this walk can get a school zone. Ask the principal to request a crossing guard, " +
      "and ask the City for a crosswalk or a traffic-signal study through 311.",
    zoneNoRoads: "No intersections with the City's listed roads were found in this geometry. Other streets may still need review.",
    deadlinePill: "Applications close April 15",
    inside: "See what's inside",
    give: "Give it to",
    principalOf: (s: string) => `The principal of ${s}`,
    office: "Ask at the front office.",
    busPrek: "Pre-K: HISD's page says there's no bus service unless an IEP or 504 plan includes it. You can still send the request.",
    insideH: "What's in the page for HISD",
    busItems: [
      "A map of the walk, with each road and track marked",
      "Each road and track, with the City's crash counts and the nearest traffic light or rail crossing",
      "The walk to the shuttle pickup, while the shuttle runs",
      "Your suggested bus stop",
      "Lines for your child's name, student ID and grade, and for the sidewalk and where your child crosses",
      "Text to paste into HISD's online form",
    ],
    openPacket: "Open the page for HISD",
    busHow: "File it yourself on HISD's online form, and give a printed copy to the principal. The page shows you how.",
    zoneDeadline: (y: number) => `Applications close April 15, ${y}`,
    zoneDeadlineSub:
      "The principal applies to Houston Public Works. An application in April 2027 is the one that can have signs up before the shuttle ends.",
    streets: "Potential road intersections",
    path: {
      borders: "Borders the school. The City's rules allow a zone here.",
      thoroughfare: "A major street on the City's plan. The City's rules allow a zone here.",
      neither: "A local street that doesn't border the school. The City's rules don't allow a zone here.",
      notCity: (owner: string) => `Owned by ${owner}, not the City. The City's form asks for a City street.`,
      unknown: "Not checked against the City's rules.",
    },
    draft: (s: string) => `This app has a draft of the City's application for ${s}, filled in from public data, for the principal to review and sign. It's in English.`,
    openDraft: "Open the principal's draft",
    shareSchool: "Share with the school",
    shareTitle: "Share this walk",
    yourMsg: "Your message",
    send: "Share",
    close: "Close",
    msg: (addr: string, school: string, crosses: string, url: string) => `Walk Check for ${addr}. The walk to ${school}: ${crosses} ${url}`,
    msgSchool: (school: string, crosses: string, url: string) =>
      `To the principal of ${school}: a family on your new walk. ${crosses} Could the school ask HISD about a bus stop, or the City about a school zone or crossing guard? ${url}`,
    msgSite: (url: string) => `Walk Check shows what a child's walk to the new school crosses, and how to ask for a bus stop or a school zone. ${url}`,
    msgZone: (zone: string, now: number, before: number, url: string) =>
      `${zone}: in ${now} of 10 parts of the old zone, the walk to school now crosses a dangerous road or train tracks. Before, ${before} in 10. ${url}`,
    changedH1: "What the closures changed",
    inTen: (n: number) => `${n} in 10`,
    bigText: "of the area in the seven closed zones now has a walk to school that crosses a dangerous road or train tracks.",
    bigBefore: (n: number) => `Before the closures: ${n} in 10.`,
    shareOf: "Share of each zone's area whose walk crosses a dangerous road or train tracks",
    before: "Walk before", after: "Walk now",
    tap: "Tap a school to see its walk.",
    checkAddr: "Check my address",
    zoneStat: (b: number) => `of this area now has a walk that crosses a dangerous road or train tracks. Before, ${b} in 10 did.`,
    hazardBar: "Dangerous road or train tracks",
    railBar: "Train tracks",
    farther: "farther, for a typical home",
    nearer: "nearer, for a typical home",
    fartherPct: "of the area is farther from school",
    over2: "of the area is 2+ miles away, the distance for a bus",
    pickup: (s: string, addr: string) => `Picks up at ${s}, ${addr}.`,
    pickupNone: "No shuttle trip from this campus.",
  },
};

export type Dict = typeof en;

const es: Dict = {
  htmlLang: "es",
  brand: "Revise el camino a la escuela",
  nav: { check: "Revisar una dirección", zones: "Zonas cerradas", corridors: "Calles", april15: "Antes del 15 de abril" },
  langToggle: "English",
  langToggleTitle: "See this page in English",
  loading: "Cargando los mapas de HISD y de la Ciudad…",
  unreviewed: "Traducción del equipo, sin revisión profesional.",
  englishOnly: "Esta página es para el personal de la Ciudad y de HISD, y está en inglés.",

  lookup: {
    h1: "Revise el camino de su hijo a la escuela",
    tagline: "Las propias reglas de HISD, aplicadas a su calle.",
    lede:
      "Siete escuelas primarias de HISD cerraron después del año escolar pasado. Escriba la dirección de su casa. Verá lo que " +
      "cruza el camino de su hijo, como vías del tren y las calles más peligrosas de la Ciudad, y tendrá una página para imprimir " +
      "o copiar para HISD.",
    addrLabel: "Dirección de su casa",
    addrPlaceholder: "Dirección, por ejemplo 1800 McCarty St",
    check: "Revisar",
    searching: "Buscando…",
    orMap: "O haga clic en su casa en el mapa.",
    showMap: "Ver el mapa",
    hideMap: "Ocultar el mapa",
    noMatch: "No encontramos esa dirección en Houston. Agregue el código postal o elija su casa en el mapa.",
    searchDown: "La búsqueda de direcciones no responde. Elija su casa en el mapa.",
    tryZone: "Pruebe el área de una escuela cerrada:",
    samplePoint: (zone: string) => `Punto de ejemplo en el área de la antigua ${zone}`,
    home: "Casa",
    lastYear: (s: string) => `Escuela del año pasado: ${s}`,
    thisYear: (s: string) => `Escuela de este año: ${s}`,
    stop: "Parada sugerida",
    dragStop: "Parada sugerida: muévame",
  },

  routing: {
    loading: "Buscando un camino peatonal. Por ahora se muestra una estimación en línea recta.",
    unavailable: "Camino peatonal no disponible. Las líneas discontinuas y los peligros listados son estimaciones en línea recta, no indicaciones.",
    ready: "Camino peatonal estimado · openrouteservice / colaboradores de OpenStreetMap",
    distance: (x: string) => `${x} por el camino peatonal del mapa`,
    caveat: "Los peligros listados son posibles intersecciones en un mapa plano. Hay que revisar puentes, túneles, aceras y acceso; un semáforo cercano no es una indicación para cruzar.",
    endpoints: (a: number, b: number) => `El camino del mapa empieza a ${a} m del punto de la casa y termina a ${b} m del punto de la escuela. El acceso por estos espacios no está verificado y no se incluye en la distancia peatonal.`,
    endpoint: "Extremo del camino peatonal del mapa; la conexión al punto no está verificada",
    possible: "Posibles intersecciones con calles o vías del tren listadas:",
    noHits: "No se encontraron intersecciones con los peligros listados en esta geometría. Puede haber otros peligros.",
    control: (label: string, distance: string) => `Control cercano: ${label}, a ${distance} en línea recta de la intersección del mapa. No se ha verificado un camino peatonal hasta él.`,
    noControl: "No se encontró un control cercano en los datos disponibles. Revise los cruces y el acceso localmente.",
    comparison: "Los dos caminos muestran distintas posibles intersecciones con vías del tren. Confirme los cruces reales localmente.",
    distanceBasis: "La estimación de la regla de distancia de abajo sigue usando la línea recta. La distancia peatonal se muestra por separado; HISD decide la elegibilidad.",
    mapNote: "Se muestra el camino por calles cuando está disponible; si falla, se usan estimaciones discontinuas. Los círculos marcan la red del mapa, no una entrada verificada.",
  },

  result: {
    outside: "Este punto está fuera de las zonas de primaria de HISD.",
    headlineClosed: (old: string, now: string) => `${old} cerró. La escuela primaria de esta casa ahora es ${now}.`,
    headlineOpen: (now: string) => `La escuela primaria de esta casa es ${now}. Su escuela no cerró.`,
    wasLastYear: (was: string) => ` El año pasado era ${was}.`,
    walkShuttle: (old: string) => `Caminar al autobús de enlace en ${old}`,
    walkShuttleWhen: "Hasta el final del año escolar 2027–28",
    walkDirect: (now: string) => `Caminar directo a ${now}`,
    walkDirectWhen: "Si no usa el autobús de enlace, y para todos cuando termine",
    walkOnly: (now: string) => `Caminar a ${now}`,
    miles: (x: string) => `unas ${x} en línea recta`,
    crosses: (rail: boolean, roads: number) => {
      const parts = [rail && "vías del tren", roads > 0 && plural(roads, "calle peligrosa", "calles peligrosas")].filter(Boolean);
      return parts.length ? `Posibles intersecciones en el mapa: ${parts.join(" y ")}.` : "No se encontraron intersecciones con peligros listados en esta geometría.";
    },
    details: "Ver cada calle y vía",
    shuttleAddsRail: (now: string) => `El camino al autobús de enlace cruza vías del tren. Caminar directo a ${now} no las cruza.`,
    shuttleAvoidsRail: (now: string) => `Caminar directo a ${now} cruza vías del tren. El autobús de enlace las evita mientras siga funcionando.`,
    cliff: (x: string, now: string) =>
      `El autobús de enlace termina después del año escolar 2027–28. Después, HISD da autobús solo a estudiantes que viven a 2 millas ` +
      `o más de la escuela. Esta casa está a unas ${x} de ${now}, así que no tendrá autobús por distancia. La otra forma de pedirlo ` +
      `es una solicitud de ruta peligrosa, y esta página reúne la evidencia.`,
    under2: (x: string, now: string) =>
      `Esta casa está a unas ${x} de ${now}, menos de 2 millas. HISD da autobús por distancia solo desde 2 millas. ` +
      `La otra forma de pedirlo es una solicitud de ruta peligrosa, y esta página reúne la evidencia.`,
    over2: (x: string, now: string) =>
      `Esta casa está a unas ${x} de ${now} en línea recta, 2 millas o más. HISD da autobús a estudiantes que viven así de lejos, ` +
      `así que primero pregunte en la escuela por el autobús normal.`,
    distanceLabel: "Distancia",
    cliffLabel: "Cuando termine el autobús de enlace",
    preK:
      "La página de transporte de HISD dice que los estudiantes de Pre-K 3 y Pre-K 4 no reciben autobús de HISD, a menos que un " +
      "plan IEP o 504 lo incluya. Pregunte en la escuela qué ayuda hay para Pre-K.",
    preKLabel: "Pre-K",
    railNote:
      "Un reportaje sobre el proceso de HISD (Houston Landing, diciembre de 2024) dice que, para estudiantes de primaria, cruzar " +
      "vías del tren cuenta como un camino peligroso. Solo HISD puede decidir.",
    railLabel: "Vías del tren",
    shuttleTitle: "El autobús de enlace por el cierre",
    shuttleBody: (old: string, addr: string, dest: string) =>
      `HISD tiene un autobús de ${old} (${addr}) a ${dest} para cualquier estudiante de K–12 afectado por el cierre, en 2026–27 ` +
      `y 2027–28. Su hijo todavía camina a ${old} para tomarlo.`,
    and: " y ",
    notPublished:
      "HISD no ha publicado en qué parte de la escuela para el autobús ni a qué hora pasa. Pregunte a la línea de HISD para familias " +
      "sobre los cierres: 713-556-7121.",
    stopTitle: "Sugiera una parada de autobús",
    stopBody:
      "El formulario de rutas peligrosas de HISD pide dónde debería estar la parada. El pin S empieza en su casa. Muévalo a una " +
      "esquina de su lado de las vías y las calles peligrosas.",
    resetStop: "Regresarlo a la casa",
    packetButton: "Obtener la página para HISD →",
    planButton: "Imprimir un plan del camino",
    sms: "Enviarme esto por mensaje de texto",
    smsBody: (addr: string, now: string, crosses: string, url: string) => `Revisión del camino para ${addr}. Camino a ${now}: ${crosses} ${url}`,
  },

  hazard: {
    rail: "Vías del tren (activas)",
    ped: "Peligrosa para peatones",
    hin: "Calle de alto riesgo",
    railName: (company: string) => `Vía del tren activa: ${company}`,
    counts: (c: number, d: number) =>
      `Donde la línea la cruza: ${plural(c, "choque", "choques")} con peatones, ${plural(d, "muerte", "muertes")}.`,
    whole: (miles: string, c: number, d: number) =>
      `Toda la calle en la lista de la Ciudad: ${miles} mi, ${plural(c, "choque", "choques")} con peatones, ${plural(d, "muerte", "muertes")}.`,
    none: "No cruza vías del tren ni calles de las listas de calles peligrosas de la Ciudad.",
  },

  cross: {
    dirs: { n: "al norte", ne: "al noreste", e: "al este", se: "al sureste", s: "al sur", sw: "al suroeste", w: "al oeste", nw: "al noroeste" },
    railKinds: {
      underpass: "la calle pasa por debajo de las vías",
      bridge: "la calle pasa por encima de las vías",
      path: "un cruce para peatones",
      gatesLights: "barreras y luces intermitentes",
      gates: "barreras",
      lights: "luces intermitentes",
      none: "sin barreras ni luces",
    },
    atLight: (label: string, dist: string, dir: string) => `Cruce en el semáforo de ${label}, a ${dist} ${dir} de donde la línea cruza la calle.`,
    atLightHere: (label: string) => `Cruce en el semáforo de ${label}. Está justo donde la línea cruza la calle.`,
    atRail: (label: string, kind: string, dist: string, dir: string) => `Cruce las vías en ${label} (${kind}), a ${dist} ${dir} de donde la línea cruza las vías.`,
    atRailHere: (label: string, kind: string) => `Cruce las vías en ${label} (${kind}). Está justo donde la línea cruza las vías.`,
    adds: (x: string) => `Eso agrega unos ${x} al camino.`,
    addsNothing: "Eso casi no agrega distancia al camino.",
    noLight: (near: string) => `No hay semáforo en esta calle a menos de ${near} de donde la línea la cruza.`,
    noRail: (near: string) => `No hay cruce público de tren a menos de ${near} de donde la línea cruza las vías.`,
    nearestLight: (label: string, dist: string, dir: string, adds: string) => `El más cercano está en ${label}, a ${dist} ${dir}. Cruzar ahí agrega unos ${adds}.`,
    nearestRail: (label: string, kind: string, dist: string, dir: string, adds: string) =>
      `El más cercano es ${label} (${kind}), a ${dist} ${dir}. Cruzar ahí agrega unos ${adds}.`,
    noneWithin: (far: string) => `No hay ninguno a menos de ${far}.`,
    whoLabel: "Quién puede cambiar esto",
    whoRoad: (school: string) =>
      `La Ciudad. Pida a la dirección de ${school} que solicite a la Ciudad un guardia de cruce aquí. Si la calle califica, la ` +
      `dirección también puede solicitar una zona escolar (las solicitudes cierran el 15 de abril). Usted puede reportar el cruce a la Ciudad por el 311.`,
    whoRoadNoZone: (school: string) =>
      `La Ciudad. Pida a la dirección de ${school} que solicite a la Ciudad un guardia de cruce aquí. También puede pedir a la ` +
      `Ciudad un paso peatonal o un estudio de semáforo por el 311. Según las reglas de la Ciudad, estas calles no pueden tener zona escolar.`,
    whoRail:
      "HISD decide dónde van las paradas de autobús. Para preguntar por un camino que cruza vías del tren, use la página para HISD en esta aplicación.",
    crashSummary: "Choques según la Ciudad",
    caveat:
      "Solo semáforos. Los guardias de cruce, las señales de alto y los pasos peatonales no aparecen en ningún mapa público, así que " +
      "un cruce con guardia sale aquí como \"sin semáforo\". En un semáforo, los carros que dan vuelta también cruzan su paso.",
    pathAdds: (x: string) => `Cruzar en todos los semáforos y cruces de tren nombrados arriba agrega unos ${x} en total.`,
    lightTip: (label: string) => `Semáforo: ${label}`,
    railTip: (label: string, kind: string) => `Cruce de tren: ${label} (${kind})`,
  },

  dates: (p: { rail: string; zones: string; schools: string; lights: string; xings: string }) =>
    `Fechas de los datos: listas de choques de la Ciudad 2022 · vías del tren de HISD ${p.rail} · límites de asistencia de HISD ${p.zones} · ` +
    `lista de escuelas ${p.schools} · semáforos leídos ${p.lights} · cruces de tren ${p.xings}.`,

  plan: {
    back: "← Regresar al camino",
    print: "Imprimir o guardar como PDF",
    eyebrow: "Plan del camino",
    title: (school: string) => `Plan del camino a ${school}`,
    forHome: (addr: string) => `Para la casa en ${addr}.`,
    first: "Primero: revise el camino, las entradas y los cruces localmente antes de usarlo con su hijo.",
    walkShuttle: (old: string) => `Camino al autobús de enlace en ${old}, hasta el final del año escolar 2027–28`,
    walkDirect: (now: string) => `Camino directo a ${now}`,
    walkOnly: (now: string) => `Camino a ${now}`,
    noCrossings:
      "Este camino no cruza vías del tren ni calles de las listas de calles peligrosas de la Ciudad. Hágalo una vez de todos modos para ver las esquinas.",
    doOnce: "Tres cosas para hacer una vez",
    do1: "Revise el camino y el acceso real a los cruces antes de caminar con su hijo.",
    do2Shuttle: (old: string) =>
      `Mientras funcione el autobús de enlace (hasta 2027–28), pregunte en la escuela o en la línea de HISD para familias sobre los cierres, 713-556-7121, dónde para en ${old} y a qué hora.`,
    do2: (now: string) => `Pregunte en ${now} si hay un guardia de cruce en el camino de su hijo, y dónde.`,
    do3: "Envíe a HISD una solicitud sobre el camino. La página para HISD en esta aplicación llena los detalles por usted.",
    mapNote: "Líneas rectas, no calles. La línea punteada azul verdosa pasa por los semáforos y cruces nombrados arriba.",
    by: "Hecho con datos públicos de HISD, la Ciudad de Houston, Houston TranStar y el gobierno federal sobre vías del tren. No es un documento de HISD.",
    missing: "Este enlace no tiene una ubicación de casa que se pueda usar.",
    start: "Empiece con una dirección",
  },

  legend: {
    aria: "Leyenda del mapa",
    walkNow: "Camino a la escuela de este año",
    walkOld: "Camino al autobús de enlace, o a la escuela del año pasado",
    shuttle: "Autobús de enlace por el cierre, de la recogida a la entrega (HISD no ha publicado paradas ni calles exactas)",
    ped: "Calle que la Ciudad considera peligrosa para peatones (2022)",
    hin: "Calle de alto riesgo (Ciudad de Houston, 2022)",
    rail: "Vías del tren activas (capa del mapa de HISD)",
    controls: "Semáforo o cruce público de tren cercano (solo como referencia)",
    path: "Camino por los semáforos y cruces",
  },

  shuttleMap: {
    line: (from: string, to: string, miles: string) =>
      `Autobús de enlace: ${from} → ${to}, ${miles} mi en línea recta. HISD no ha publicado por qué calles va.`,
    dropOff: (name: string) => `Entrega del autobús de enlace: ${name}`,
    exactSpot: (addr: string) => `${addr}. El lugar exacto no está publicado.`,
    sameSite: (addr: string) => `Mismo edificio, ${addr}. No hay viaje en autobús de enlace.`,
    pickup: (name: string) => `Recogida del autobús de enlace: ${name}`,
    closedOrMoved: "(cerrada o trasladada)",
    somewhere: (addr: string) => `${addr}. La parada está en algún lugar de esta escuela.`,
    to: "A: ",
  },

  notes: {
    title: "Para tener en cuenta.",
    body:
      "Las páginas de direcciones usan caminos peatonales cuando están disponibles e identifican las estimaciones en línea recta. " +
      "Los caminos por calles pueden cruzar otros peligros. Esta página reúne evidencia. HISD decide quién recibe autobús.",
    more: "Más detalles",
    law:
      "La prueba de Texas para un camino peligroso (Código de Educación de Texas §48.151) también pregunta si hay acera (banqueta). " +
      "Houston no publica datos de aceras, así que esa parte la tiene que dar la familia.",
    area: "Los porcentajes son partes del área de cada zona, medidas en una cuadrícula pareja. No son conteos de estudiantes ni de casas.",
    vintageSummary: (date: string) => `De dónde vienen los datos · copia del ${date}`,
    features: (n: string, date: string) => `${n} elementos, última edición ${date}`,
    unknown: "desconocida",
    layers: {
      zones_old: "Zonas de primaria 2025–26",
      zones_new: "Zonas de primaria 2026–27",
      schools_old: "Ubicación de escuelas 2025–26",
      schools_new: "Ubicación de escuelas 2026–27",
      rail: "Vías del tren activas (HISD)",
      ped_hin: "Calles peligrosas para peatones (Ciudad, HIN 2022)",
      hin: "Red de calles de alto riesgo (Ciudad, 2022)",
    },
    grounds: "Terrenos escolares (colaboradores de OpenStreetMap)",
    signals: "Semáforos (Ciudad, TxDOT, Condado de Harris, vía Houston TranStar)",
    signalsCount: (n: string, date: string) => `${n} semáforos, leídos el ${date}; la fuente no tiene fecha`,
    railXings: "Cruces públicos de tren (inventario de cruces de la FRA)",
    railXingsCount: (n: string, date: string) => `${n} cruces en el Condado de Harris, datos actualizados el ${date}`,
    mtfp: "Clase de calle (Plan de Vías Principales de la Ciudad de Houston)",
    centerline: "Ejes de calles (Ciudad de Houston)",
    layerEdited: (date: string) => `última edición ${date}`,
    groundsCount: (n: number, date: string) => `${n} contornos alrededor de las escuelas del autobús de enlace, última edición ${date}`,
    pairings: "Rutas del autobús de enlace:",
    pairingsTail: "HISD no ha publicado paradas, horarios ni rutas de los autobuses de enlace.",
    vintageNote:
      "Los conteos de choques vienen de la Red de Lesiones Graves 2022 de la Ciudad, la más reciente que publica. La capa de vías del " +
      "tren se editó por última vez en 2024; el estado de las vías puede haber cambiado.",
  },

  packet: {
    back: "← Regresar al camino",
    print: "Imprimir o guardar como PDF",
    howTitle: "Cómo enviar esto a HISD",
    howIntro: "Hay dos formas. Puede usar las dos.",
    way1Title: "1. Envíelo usted en línea",
    way1Before: "Abra el ",
    way1Link: "formulario de solicitud de apoyo de transporte de HISD (Transportation Support Request Form)",
    way1After:
      '. Elija "Walk Route Concerns" (preocupaciones sobre la ruta a pie). Pegue el texto de abajo en la casilla Description. ' +
      "Necesita el número de estudiante de su hijo (una S y 7 números). El formulario no acepta archivos, así que también imprima " +
      "esta página y entréguela en la oficina de la escuela.",
    way2Title: "2. Pida a la escuela que lo envíe",
    way2: (school: string) =>
      `Entregue una copia impresa a la dirección de ${school}. Pida que envíen a HISD una solicitud de ruta peligrosa para su área. ` +
      `Según la política de HISD (CNA, Anexo B), esa solicitud la inicia el director o la directora.`,
    timing:
      "Las páginas de HISD dan de 5 a 10 días hábiles para solicitudes de transporte. No dicen cuánto tarda una solicitud sobre la " +
      "ruta a pie. Solo HISD decide quién recibe autobús.",
    copyTitle: "Texto para pegar en el formulario",
    copyNote: "Está en inglés porque lo lee el personal de HISD.",
    addSidewalk:
      "Antes de copiarlo, agregue una frase al final: ¿hay acera (banqueta) y dónde cruza su hijo? La regla de HISD pregunta por " +
      "las aceras, y ningún mapa público las muestra. Puede escribirla en español.",
    copy: "Copiar texto",
    copied: "Copiado",
    copyFailed: "Seleccione el texto y cópielo.",
    printNote: "La página impresa está en inglés porque la lee el personal de HISD.",
  },

  wc: {
    brand: "Walk Check",
    home: "Inicio de Walk Check",
    nav: { schools: "Escuelas que cerraron", principals: "Para directores" },
    staff: "Para el personal de la Ciudad y de HISD (en inglés):",
    staffLinks: { zones: "Datos de las zonas cerradas", corridors: "Calles", april15: "Antes del 15 de abril" },
    back: "Atrás",
    h1: "¿Qué cruza su hijo en el camino a la nueva escuela?",
    lede: "Siete escuelas primarias de HISD cerraron después del año escolar pasado. Escriba su dirección. Verá las calles peligrosas y las vías del tren en el camino de su hijo, dónde cruzarlas y cómo pedir un cambio.",
    addr: "Dirección de su casa",
    addrPlaceholder: "Dirección, Houston, TX",
    check: "Revisar el camino",
    pickMap: "Elegir mi casa en un mapa",
    hideMap: "Ocultar el mapa",
    mapHint: "Toque su casa en el mapa.",
    tryZone: "O pruebe un punto en el área de una escuela cerrada:",
    closed: "Escuelas que cerraron",
    see: "Ver",
    pair: (from: string, to: string) => `${from} a ${to}`,
    prekQ: "¿Su hijo está en Pre-K?",
    prekWhy: "Las reglas de autobús de HISD son distintas para Pre-K.",
    yes: "Sí", yesSub: "Pre-K 3 o Pre-K 4",
    no: "No", noSub: "Kínder a 5.º grado",
    verdict: (to: string, rail: boolean, roads: number) => {
      const parts = [rail && "vías del tren", roads > 0 && plural(roads, "calle peligrosa", "calles peligrosas")].filter(Boolean);
      return parts.length
        ? `La línea del mapa a ${to} puede intersectar ${parts.join(" y ")}.`
        : `No se encontraron intersecciones con peligros listados en la línea del mapa a ${to}. Puede haber otros peligros.`;
    },
    lastYear: "El año pasado",
    now: "Ahora",
    closedTag: "cerró",
    nCrossings: (n: number) => (n === 0 ? "sin intersecciones listadas" : plural(n, "posible intersección", "posibles intersecciones")),
    walk: "Posibles intersecciones, en orden",
    walkAria: (steps: string) => `Esquema de posibles intersecciones en orden; no son indicaciones: ${steps}`,
    home1: "Casa",
    whereToCross: "Controles de cruce cercanos para revisar",
    shuttleTitle: "Autobús de enlace por el cierre, hasta el final del año escolar 2027–28",
    shuttleWalk: (old: string) => `El camino al autobús de enlace en ${old}`,
    shuttleSame: "Cruza las mismas calles y vías que el camino del año pasado.",
    prekTitle: "Las reglas de autobús de HISD no incluyen Pre-K",
    prekBody:
      "La página de transporte de HISD dice que los estudiantes de Pre-K 3 y Pre-K 4 no reciben autobús de HISD, a menos que un plan IEP o 504 lo incluya. " +
      "El anuncio del autobús de enlace dice K–12 y no menciona Pre-K. Pregunte a la dirección qué ayuda hay.",
    showMap: "Ver el mapa",
    mapAlt: "Mapa: ubicaciones originales de casa y escuelas, geometría del camino y posibles intersecciones",
    ask: "Pedir un cambio",
    askZone: "Pedir una zona escolar",
    print: "Imprimir un plan del camino",
    printShort: "Imprimir",
    share: "Compartir",
    outside: "Este punto está fuera de las zonas de primaria de HISD.",
    notClosed: "Esta dirección no está en una de las siete zonas cerradas.",
    zoned: "Escuela asignada",
    same: "Igual que el año pasado",
    was: (s: string) => `El año pasado: ${s}`,
    seeWalk: "Revisar este camino peatonal",
    seeClosed: "Ver las escuelas que cerraron",
    another: "Probar otra dirección",
    know: (names: string) => `¿Conoce a una familia cerca de ${names}?`,
    helpH1: "Dos formas de pedir un cambio en este camino",
    helpSub: "La dirección de la escuela puede enviar las dos. La primera también la puede enviar usted.",
    busH: "Pedir un autobús a HISD",
    busSub: "Una solicitud de ruta peligrosa. HISD puede agregar una parada cuando un camino cruza calles peligrosas o vías del tren. Solo HISD decide.",
    zoneH: "Pedir una zona escolar a la Ciudad",
    zoneSub: "Un límite de velocidad más bajo en horario escolar, con letreros, en una calle que cruza su hijo. Solo la dirección de la escuela puede solicitarla.",
    zoneNone:
      "Según las reglas de la Ciudad, ninguna calle de este camino puede tener zona escolar. Pida a la dirección que solicite un guardia de cruce, " +
      "y pida a la Ciudad un paso peatonal o un estudio de semáforo por el 311.",
    zoneNoRoads: "No se encontraron intersecciones con calles listadas en esta geometría. Puede haber otras calles que revisar.",
    deadlinePill: "Las solicitudes cierran el 15 de abril",
    inside: "Ver qué incluye",
    give: "Entréguelo a",
    principalOf: (s: string) => `La dirección de ${s}`,
    office: "Pregunte en la oficina.",
    busPrek: "Pre-K: la página de HISD dice que no hay autobús a menos que un plan IEP o 504 lo incluya. Aun así puede enviar la solicitud.",
    insideH: "Qué incluye la página para HISD",
    busItems: [
      "Un mapa del camino con cada calle y vía marcada",
      "Cada calle y vía, con los choques registrados por la Ciudad y el semáforo o cruce de tren más cercano",
      "El camino a la parada del autobús de enlace, mientras funcione",
      "La parada de autobús que usted sugiere",
      "Líneas para el nombre, número de estudiante y grado de su hijo, y para la acera y dónde cruza",
      "Texto para pegar en el formulario en línea de HISD",
    ],
    openPacket: "Abrir la página para HISD",
    busHow: "Envíelo usted en el formulario en línea de HISD y entregue una copia impresa a la dirección. La página le explica cómo.",
    zoneDeadline: (y: number) => `Las solicitudes cierran el 15 de abril de ${y}`,
    zoneDeadlineSub:
      "La dirección de la escuela la envía a Obras Públicas de Houston. Una solicitud en abril de 2027 es la que puede tener letreros antes de que termine el autobús de enlace.",
    streets: "Posibles intersecciones con calles",
    path: {
      borders: "Está junto a la escuela. Las reglas de la Ciudad permiten una zona aquí.",
      thoroughfare: "Una calle principal en el plan de la Ciudad. Las reglas de la Ciudad permiten una zona aquí.",
      neither: "Una calle local que no está junto a la escuela. Las reglas de la Ciudad no permiten una zona aquí.",
      notCity: (owner: string) => `Es de ${owner}, no de la Ciudad. El formulario de la Ciudad pide una calle de la Ciudad.`,
      unknown: "No se revisó con las reglas de la Ciudad.",
    },
    draft: (s: string) => `Esta aplicación tiene un borrador de la solicitud de la Ciudad para ${s}, llenado con datos públicos, para que la dirección lo revise y lo firme. Está en inglés.`,
    openDraft: "Abrir el borrador para la dirección",
    shareSchool: "Compartir con la escuela",
    shareTitle: "Compartir este camino",
    yourMsg: "Su mensaje",
    send: "Compartir",
    close: "Cerrar",
    msg: (addr: string, school: string, crosses: string, url: string) => `Walk Check para ${addr}. El camino a ${school}: ${crosses} ${url}`,
    msgSchool: (school: string, crosses: string, url: string) =>
      `A la dirección de ${school}: somos una familia del nuevo camino. ${crosses} ¿Podría la escuela preguntar a HISD por una parada de autobús, o a la Ciudad por una zona escolar o un guardia de cruce? ${url}`,
    msgSite: (url: string) => `Walk Check muestra lo que cruza el camino de un niño a la nueva escuela, y cómo pedir una parada de autobús o una zona escolar. ${url}`,
    msgZone: (zone: string, now: number, before: number, url: string) =>
      `${zone}: en ${now} de cada 10 partes de la antigua zona, el camino a la escuela ahora cruza una calle peligrosa o vías del tren. Antes, ${before} de 10. ${url}`,
    changedH1: "Qué cambió con los cierres",
    inTen: (n: number) => `${n} de 10`,
    bigText: "del área de las siete zonas cerradas ahora tiene un camino a la escuela que cruza una calle peligrosa o vías del tren.",
    bigBefore: (n: number) => `Antes de los cierres: ${n} de 10.`,
    shareOf: "Parte del área de cada zona cuyo camino cruza una calle peligrosa o vías del tren",
    before: "Camino antes", after: "Camino ahora",
    tap: "Toque una escuela para ver su camino.",
    checkAddr: "Revisar mi dirección",
    zoneStat: (b: number) => `de esta área ahora tiene un camino que cruza una calle peligrosa o vías del tren. Antes, ${b} de 10.`,
    hazardBar: "Calle peligrosa o vías del tren",
    railBar: "Vías del tren",
    farther: "más lejos, para una casa típica",
    nearer: "más cerca, para una casa típica",
    fartherPct: "del área queda más lejos de la escuela",
    over2: "del área está a 2 millas o más, la distancia para autobús",
    pickup: (s: string, addr: string) => `Recoge en ${s}, ${addr}.`,
    pickupNone: "No hay viaje de autobús de enlace desde esta escuela.",
  },
};

export const DICTS: Record<Lang, Dict> = { en, es };

// Strings that arrive as data (scripts/shuttle-pairs.ts → shuttles.json), translated at display time.
// A string not listed here shows as written, so a reworded flag falls back to English rather than breaking.
const DATA_ES: Record<string, string> = {
  "HISD announced Roosevelt ES and C. Martinez ES. Its 2026–27 boundary layer assigns the former Ross zone to Dogan ES and Roosevelt ES. Confirm with HISD.":
    "HISD anunció Roosevelt ES y C. Martinez ES. Su mapa de zonas 2026–27 asigna la antigua zona de Ross a Dogan ES y Roosevelt ES. Confírmelo con HISD.",
  "The shuttle promise says K-12. Pre-K isn't named, and Hobby's pre-K and kindergarten go to MLK ECC, not the Lawson site.":
    "El anuncio del autobús de enlace dice K-12. No menciona Pre-K, y el Pre-K y kínder de Hobby van a MLK ECC, no a la sede de Lawson.",
  "In 2026–27 the old McReynolds building at 5910 Market St houses HISD's Secondary DAEP (HISD campus layer).":
    "En 2026–27, el antiguo edificio de McReynolds en 5910 Market St aloja el DAEP de secundaria de HISD (capa de escuelas de HISD).",
  "Grades 1–5": "Grados 1–5",
  "Pre-K and kindergarten": "Pre-K y kínder",
};
export const dataText = (lang: Lang, s: string) => (lang === "es" ? DATA_ES[s] ?? s : s);

export const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

export function useT() {
  const { lang, setLang } = useContext(LangContext);
  return { lang, setLang, t: DICTS[lang] };
}

/** ?lang=es before or after the # both work, so a flyer link or QR code can open the page in Spanish. */
export function initialLang(): Lang {
  const inHash = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("lang");
  const q = new URLSearchParams(window.location.search).get("lang") ?? inHash;
  if (q === "es" || q === "en") return q;
  try {
    const saved = localStorage.getItem("lang");
    if (saved === "es" || saved === "en") return saved;
  } catch {
    /* storage blocked: fall through */
  }
  return "en";
}

/** Keep the choice in the URL (outside the hash, which the router owns) and, where allowed, in storage. */
export function persistLang(lang: Lang) {
  try {
    localStorage.setItem("lang", lang);
  } catch {
    /* storage blocked: the URL still carries it */
  }
  const u = new URL(window.location.href);
  if (lang === "es") u.searchParams.set("lang", "es");
  else u.searchParams.delete("lang");
  window.history.replaceState(window.history.state, "", u);
}

/** The current page as a link that reopens in the same language. */
export function shareUrl(lang: Lang) {
  const u = new URL(window.location.href);
  if (lang === "es") u.searchParams.set("lang", "es");
  else u.searchParams.delete("lang");
  return u.toString();
}
