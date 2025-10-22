import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center p-6">Laddar…</div>}>
      <LoginForm />
    </Suspense>
  );
}
