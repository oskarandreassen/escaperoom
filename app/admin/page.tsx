// app/admin/page.tsx
import { db } from "@/lib/db";
import { contentClues, teams } from "@/lib/schema";
import { eq } from "drizzle-orm";

type TeamRow = {
  id: string;
  teamName: string;
  step: number;
  penaltiesSec: number;
};

type ClueRow = {
  id: string;
  title: string | null;
  expectedDigit: number;
};

export default async function AdminPage() {
  const clueList = await db
    .select({
      id: contentClues.id,
      title: contentClues.title,
      expectedDigit: contentClues.expectedDigit,
    })
    .from(contentClues)
    .where(eq(contentClues.active, true));

  const teamList = await db
    .select({
      id: teams.id,
      teamName: teams.teamName,
      step: teams.step,
      penaltiesSec: teams.penaltiesSec,
    })
    .from(teams);

  const teamRows: TeamRow[] = teamList.map((r: TeamRow, _i: number) => r);
  const clueRows: ClueRow[] = clueList.map((c: ClueRow) => c);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Admin</h1>

      <section>
        <h2 className="font-medium mb-2">Aktiva ledtrådar</h2>
        <ul className="list-disc ml-4">
          {clueRows.map((c: ClueRow) => (
            <li key={c.id}>
              {c.title ?? "(utan titel)"} – förväntad siffra: {c.expectedDigit}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-medium mb-2">Lag</h2>
        <ul className="list-disc ml-4">
          {teamRows.map((t: TeamRow) => (
            <li key={t.id}>
              {t.teamName} – steg {t.step} – straff {t.penaltiesSec}s
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
