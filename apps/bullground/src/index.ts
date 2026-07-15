import path from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"

const currentDir = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: `${currentDir}/../../../.env`, quiet: true })

await import("./worker")
