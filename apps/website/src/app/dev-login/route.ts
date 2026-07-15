import { fetchUser } from "@lib/dao/user/fetch"
import { db } from "@template-nextjs/db"
import { createSession, generateSessionToken, setSessionTokenCookie } from "@website/lib/auth"

export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 })
  }
  const url = new URL(request.url)
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return new Response(null, { status: 404 })
  }
  const email = url.searchParams.get("email")
  if (!email) {
    return new Response("missing ?email=", { status: 400 })
  }
  const user = await fetchUser(db).getOneByEmail(email, ["id"])
  if (!user) {
    return new Response(`no user with email ${email}`, { status: 404 })
  }
  const sessionToken = generateSessionToken()
  const session = await createSession(sessionToken, user.id)
  await setSessionTokenCookie(sessionToken, session.expires)
  return new Response(null, { status: 302, headers: { Location: "/" } })
}
