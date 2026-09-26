// HISD's closure shuttles: "K-12 students who are impacted by a school closure will have the option to receive HISD
// transportation directly from their current campus to their receiving school site via a shuttle" (2026–27 and
// 2027–28). The pairings below are HISD's announced ones, keyed by Campus_Nbr: `from` is the 2025–26 campus point
// (the pickup), each `to` is a 2026–27 campus point (the drop-off). HISD has not published the exact stop spot,
// times or runs for any of them, so the app maps the campus, never a curb.

export interface ShuttlePair {
  from: number;
  to: { nbr: number; label?: string; grades?: string }[];
  flags?: string[];
}

export const SHUTTLE_SOURCES = [
  { label: "HISD closure FAQ (Campus Closure Resources)", url: "https://www.houstonisd.org/closure-resources" },
  { label: "HISD news post, Feb 27, 2026", url: "https://hisdnow.houstonisd.org/p/~board/district-news/post/hisd-moves-forward-with-school-closures-to-address-underutilization-and-sustain-progres" },
  { label: "click2houston, Feb 27, 2026: the 12 pairings", url: "https://www.click2houston.com/news/local/2026/02/27/info-hisd-reveals-details-for-school-reassignments-transportation-plans-after-voting-to-close-12-houston-schools/" },
];

export const SHUTTLE_PAIRS: ShuttlePair[] = [
  { from: 102, to: [{ nbr: 203 }] }, // Alcott → Mading
  { from: 117, to: [{ nbr: 292 }] }, // Briscoe → Carrillo
  { from: 125, to: [{ nbr: 188 }] }, // Burrus → Kennedy
  { from: 155, to: [{ nbr: 291 }] }, // Franklin → Gallegos
  { from: 172, to: [{ nbr: 121 }] }, // Henderson NQ → Bruce
  { from: 222, to: [{ nbr: 220 }] }, // Port Houston → Pleasantville
  {
    from: 232, to: [{ nbr: 231 }, { nbr: 289 }], // Ross → Roosevelt, C. Martinez
    flags: ["HISD announced Roosevelt ES and C. Martinez ES. Its 2026–27 boundary layer assigns the former Ross zone to Dogan ES and Roosevelt ES. Confirm with HISD."],
  },
  {
    from: 175, // Hobby, co-located rather than closed
    to: [
      { nbr: 175, label: "Hobby ES, now at the Lawson MS site", grades: "Grades 1–5" },
      { nbr: 355, grades: "Pre-K and kindergarten" },
    ],
    flags: ["The shuttle promise says K-12. Pre-K isn't named, and Hobby's pre-K and kindergarten go to MLK ECC, not the Lawson site."],
  },
  { from: 287, to: [{ nbr: 287, label: "Cage ES, now in the Lantrip ES building" }] }, // Cage, co-located
  { from: 78, to: [{ nbr: 62, label: "Fleming McReynolds MS, in the Leland YMCPA building" }] },
  {
    from: 62, to: [{ nbr: 62, label: "Fleming McReynolds MS, in the Leland YMCPA building" }],
    flags: ["In 2026–27 the old McReynolds building at 5910 Market St houses HISD's Secondary DAEP (HISD campus layer)."],
  },
  { from: 484, to: [{ nbr: 324 }] }, // Middle College HS–Gulfton → Liberty HS, same address
];
