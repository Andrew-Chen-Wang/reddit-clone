import { client } from "./generated/client.gen"
import { client as adminClient } from "./admin-generated/client.gen"

declare const process: { env: { NODE_ENV?: string } }

export * from "./generated/client.gen"
export * from "./generated/types.gen"
export * from "./generated/sdk.gen"

export const baseUrl =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://nextjs-spa-split.andrewcwang.com"

client.setConfig({ baseUrl, credentials: "include" })
adminClient.setConfig({ baseUrl, credentials: "include" })
