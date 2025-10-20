// app/page.tsx
import StartForm from '@/components/StartForm';

export default function Page() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Halloween Escaperoom</h1>
      <section className="space-y-2 text-sm opacity-90">
        <p><b>Tid:</b> 5:00 minuter.</p>
        <p><b>Fel siffra:</b> –30 sek + 3 sek cooldown.</p>
        <p><b>Hint:</b> Inga nödhintar.</p>
        <p><b>Flöde:</b> En ledtråd i taget. Ange en siffra, nästa låses upp vid rätt svar.</p>
        <p><b>Säkerhet:</b> Max 4 personer i bastun. Rör aldrig aggregatet. Rör inte saker utan våra ikoner.</p>
        <p><b>Integritet:</b> Vi sparar lagnamn, start/slut, fel och tid kvar för statistik.</p>
      </section>
      <StartForm />
    </main>
  );
}
