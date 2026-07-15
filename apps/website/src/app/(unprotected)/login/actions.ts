"use server"

import { redirect } from "next/navigation"

// oxlint-disable-next-line typescript/require-await
export async function oauthRedirect(link: string) {
  redirect(link)
}
