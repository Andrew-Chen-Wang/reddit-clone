import { Queue } from "bullmq"
import { connection } from "./connection"

export const fastQueue = new Queue("fast", { connection })
export const mediumQueue = new Queue("medium", { connection })
export const slowQueue = new Queue("slow", { connection })
