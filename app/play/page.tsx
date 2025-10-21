import { Suspense } from "react";
import PlayClient from "./PlayClient";

// Viktigt: dessa exporteras från SERVER-komponenten
export const dynamic = "force-dynamic";
export const revalidate = false;

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] grid place-items-center text-white/80">Laddar…</div>}>
      <PlayClient />
    </Suspense>
  );
}
