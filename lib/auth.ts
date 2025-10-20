// lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Admin",
      credentials: {
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials: { password?: string } | undefined) {
        if (credentials?.password && credentials.password === process.env.ADMIN_PASSWORD) {
          return { id: "admin", name: "Admin" };
        }
        return null;
      },
    }),
  ],
  session: { strategy: "jwt" },
});
