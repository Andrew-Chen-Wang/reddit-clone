import path from "node:path"
import { fileURLToPath } from "node:url"
import { Client } from "@elastic/elasticsearch"
import dotenv from "dotenv"

const currentDir = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: `${currentDir}/../../../.env`, quiet: true })

const auth =
  process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD
    ? {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD,
      }
    : undefined

export const client = new Client({
  node: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",
  auth,
})
