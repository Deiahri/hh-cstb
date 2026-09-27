// The seven closed elementary buildings the closure shuttle picks up at in 2026–27 and 2027–28: what's on the
// record about each, and what nobody has published. The pickup cards on the Closed zones page (English only, for
// City and HISD staff) show these next to the computed walk. Re-check with research/after-the-shuttle/shuttle-gaps.py
// before a demo; the rows are listed in ../VERIFY.md.

/** Campus numbers of the seven closed elementary schools, the shuttle pickups. */
export const PICKUP_CAMPUSES = [102, 117, 125, 155, 172, 222, 232];

export const SHUTTLE_TERM = "through the 2027–28 school year";
export const SHUTTLE_SOURCE = { label: "HISD closure FAQ", url: "https://www.houstonisd.org/closure-resources" };

/** One board vote covered all seven buildings (plus Cage, Fleming and three non-school sites). */
export const SURPLUS = {
  date: "Aug 13, 2026",
  text: 'HISD\'s board declared the building surplus and authorized "sales procedures, effective August 14, 2026" (9–0).',
  sale: "No sale date has been published.",
  source: {
    label: "Board minutes, Aug 13, 2026",
    url: "https://houstonisd.legistar1.com/houstonisd/meetings/2026/8/1304_M_School_Board_26-08-13_Meeting_Minutes.pdf",
  },
  checked: "2026-09-26",
};

/** What a City or HISD reader would need to know about a pickup and can't find in public: who holds each answer. */
export const NOT_PUBLIC: { short: string; who: string; what: string; ask: string }[] = [
  { short: "Stop spot and times", who: "HISD", what: "Where on campus the bus stops, and when", ask: "Ask HISD. Families got route details in early August." },
  { short: "School zone and hours", who: "HPW", what: "The City school zone at the campus and its hours", ask: "Ask Houston Public Works. A zone's hours follow its school's bell, and a closed campus has none." },
  { short: "Crossing guard", who: "HISD", what: "A crossing guard on the walk to the pickup", ask: "Ask HISD, which reports its guard posts to the City." },
];
