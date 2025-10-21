// data/clues.ts
export type ClueConfig = {
  id: string;              // stabilt id du väljer själv
  title: string;           // rubrik i UI
  icon: string;            // emoji/icon
  riddle: string;          // själva gåtan (radbryt med \n)
  type: "digit" | "code";  // "digit" = 0–9, "code" = flersiffrig kod
  expected: string;        // "3" eller "7214" etc (endast siffror)
  durationSec?: number;    // valfritt: tid för denna ledtråd (default 5*60)
  active?: boolean;        // enkel on/off
};

// **** Här styr du allt ****
export const CLUES: ClueConfig[] = [
  {
    id: "clue_sauna",
    title: "Bastu",
    icon: "🜂",
    riddle:
      "Där luften står still men andetagen blir tunga,\nOch sten möter eld i en viskande lunga.\nTrä klär väggar i tyst ceremoni,\nDär kroppen får rinna men själen bli fri.",
    type: "digit",
    expected: "3",
    durationSec: 5 * 60,
    active: true,
  },
  {
    id: "clue_lock",
    title: "Hänglås",
    icon: "🔒",
    riddle:
      "Skåp sju vaktar hemligheten väl,\nTvå skuggor dansar runt andens själ,\nEn viskning hörs från stenarnas famn,\nOm fyra lågornas tysta namn.",
    // Exempel på flersiffrig kod:
    type: "code",
    expected: "7214",
    durationSec: 5 * 60,
    active: true,
  },
  // Lägg till fler ledtrådar här – bara följ mallen
];

// Standardtid om durationSec inte är satt
export const DEFAULT_CLUE_SECONDS = 5 * 60;
