import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    signIn({ profile }) {
      // Brown-only: every Brown account is a Google account on brown.edu.
      return !!profile?.email?.endsWith("@brown.edu");
    },
    jwt({ token, profile }) {
      if (profile?.email) token.email = profile.email;
      return token;
    },
    session({ session, token }) {
      if (token.email) session.user.email = token.email as string;
      return session;
    },
  },
  pages: {
    error: "/auth-error",
  },
});
