import { Hono } from "hono"
import { RegExpRouter } from "hono/router/reg-exp-router"
import auth from "./auth"
import user from "./user"
import userSettings from "./user-settings"

const app = new Hono({
  router: new RegExpRouter(),
})
  .basePath("/v1")
  .route("/auth", auth)
  .route("/user", user)
  .route("/user", userSettings)

export default app
