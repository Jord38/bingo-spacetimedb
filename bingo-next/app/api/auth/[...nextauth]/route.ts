import NextAuth, { type NextAuthOptions } from "next-auth"
import Steam from "next-auth-steam"
import type { NextRequest } from "next/server"

// Define a type for the user profile from Steam to get steamid
interface SteamProfile {
  steamid: string
  personaname?: string // Optional: if you want to get the persona name
  [key: string]: any // Allow other properties
}

// Define a custom type for the session user to include steamId
interface SessionUser {
  name?: string | null
  email?: string | null
  image?: string | null
  steamId?: string
  steamName?: string // Added for Steam display name
}

// Define a custom type for the JWT token to include steamId
interface JWT {
  steamId?: string
  steamName?: string // Added for Steam display name
  name?: string // from profile
  picture?: string // from profile
  sub?: string
  [key: string]: any
}

export const authOptions: (req: NextRequest) => NextAuthOptions = (req: NextRequest) => ({
  providers: [
    Steam(req, {
      // The clientSecret for the Steam provider is your Steam Web API Key.
      // Ensure this environment variable is set (e.g., STEAM_SECRET).
      clientSecret: process.env.STEAM_SECRET!,
      // callbackUrl: `${process.env.NEXTAUTH_URL}/api/auth/callback/steam`, // Often inferred
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET!,
  callbacks: {
    async jwt({ token, profile, account }) {
      const jwtToken = token as JWT
      // After a successful sign-in with Steam, profile will be populated.
      if (profile && account?.provider === "steam") { // Check if provider is steam
        const steamProfile = profile as SteamProfile
        jwtToken.steamId = steamProfile.steamid
        // Optionally, add more profile info to the token
        jwtToken.steamName = steamProfile.personaname; // Capture Steam display name
        // jwtToken.picture = steamProfile.avatarfull; // or avatar, avatarmedium
      }
      return jwtToken
    },
    async session({ session, token }) {
      const jwtToken = token as JWT
      // Add steamId to the session object, making it available on the client via useSession().
      if (jwtToken.steamId && session.user) {
        (session.user as SessionUser).steamId = jwtToken.steamId
        // If you added name/picture to JWT token, pass them to session.user as well
        if (jwtToken.steamName) (session.user as SessionUser).steamName = jwtToken.steamName; // Pass steamName to session
        // if (jwtToken.picture) (session.user as SessionUser).image = jwtToken.picture;
      }
      return session
    },
  },
  // Optional: Add a sign-in page if you want a custom one
  // pages: {
  //   signIn: '/auth/signin',
  // },
  // debug: process.env.NODE_ENV === "development",
})

// The handler for App Router
// As per next-auth-steam documentation for App router:
// async function handler(req: NextRequest, ctx: { params: { nextauth: string[] }}) {
//   return NextAuth(req, ctx, authOptions(req)); // Pass req to authOptions factory
// }
// Let's simplify the handler export as NextAuth should handle req and ctx internally
// when provided with options that might depend on them.

const handler = (req: NextRequest, ctx: { params: { nextauth: string[] }}) => {
    return NextAuth(req, ctx, authOptions(req))
}

export { handler as GET, handler as POST } 