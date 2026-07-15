import { crudAccount } from "@lib/dao/account/crud"
import { fetchAccount } from "@lib/dao/account/fetch"
import { crudUser } from "@lib/dao/user/crud"
import { fetchUser } from "@lib/dao/user/fetch"
import { db } from "@template-nextjs/db"
import { createSession, generateSessionToken, setSessionTokenCookie } from "@website/lib/auth"
import { oauthGoogle } from "@website/lib/oauth"
import type { OAuth2Tokens } from "arctic"
import { decodeIdToken } from "arctic"
import { cookies } from "next/headers"

interface GoogleClaims {
  sub: string
  name: string
  email: string
  picture: string
  email_verified: boolean
  family_name: string
  given_name: string
  exp: number
}

async function generateUniqueUsername(email: string): Promise<string> {
  const base =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "") || "user"
  let candidate = base
  while (await fetchUser(db).isUsernameTaken(candidate)) {
    const length = 4 + Math.floor(Math.random() * 3)
    const suffix = Math.random()
      .toString(36)
      .replace(/[^a-z0-9]/g, "")
      .slice(0, length)
    candidate = `${base}${suffix}`
  }
  return candidate
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const cookieStore = await cookies()
  const storedState = cookieStore.get("google_oauth_state")?.value ?? null
  const codeVerifier = cookieStore.get("google_code_verifier")?.value ?? null
  cookieStore.delete("google_oauth_state")
  cookieStore.delete("google_code_verifier")
  if (code === null || state === null || storedState === null || codeVerifier === null) {
    return new Response(null, {
      status: 400,
    })
  }
  if (state !== storedState) {
    return new Response(null, {
      status: 400,
    })
  }

  let tokens: OAuth2Tokens
  try {
    tokens = await oauthGoogle.validateAuthorizationCode(code, codeVerifier)
  } catch {
    // Invalid code or client credentials
    return new Response(null, {
      status: 400,
    })
  }
  const claims = decodeIdToken(tokens.idToken()) as GoogleClaims
  const googleUserId = claims.sub
  const name = claims.name
  const email = claims.email
  const image = claims.picture
  // const emailVerified = claims.email_verified
  const exp = claims.exp

  const existingAccount = await fetchAccount(db).getOneByProvider("google", googleUserId, [
    "userId",
  ])

  if (existingAccount) {
    const sessionToken = generateSessionToken()
    const session = await createSession(sessionToken, existingAccount.userId)
    await setSessionTokenCookie(sessionToken, session.expires)
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
      },
    })
  }

  const existingUser = await fetchUser(db).getOneByEmail(email, ["id"])
  const userId =
    existingUser?.id ??
    (
      await crudUser(db).createUser({
        name,
        email,
        image,
        username: await generateUniqueUsername(email),
      })
    ).id
  await crudAccount(db).createAccount({
    userId,
    provider: "google",
    providerAccountId: googleUserId,
    type: "oauth",
    scope: tokens.scopes().join(" "),
    idToken: tokens.idToken(),
    accessToken: tokens.accessToken(),
    tokenType: tokens.tokenType(),
    expiresAt: exp,
  })

  const sessionToken = generateSessionToken()
  const session = await createSession(sessionToken, userId)
  await setSessionTokenCookie(sessionToken, session.expires)
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
    },
  })
}
