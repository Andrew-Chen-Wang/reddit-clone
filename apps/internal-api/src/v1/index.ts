import { Hono } from "hono"
import { RegExpRouter } from "hono/router/reg-exp-router"
import auth from "./auth"
import community from "./community"
import communityJoinRequest from "./community-join-request"
import communityMember from "./community-member"
import communityRule from "./community-rule"
import explore from "./explore"
import flair from "./flair"
import topic from "./topic"
import user from "./user"
import userSettings from "./user-settings"

const app = new Hono({
  router: new RegExpRouter(),
})
  .basePath("/v1")
  .route("/auth", auth)
  .route("/user", user)
  .route("/user", userSettings)
  .route("/topic", topic)
  .route("/community", community)
  .route("/community-member", communityMember)
  .route("/community-rule", communityRule)
  .route("/community-join-request", communityJoinRequest)
  .route("/flair", flair)
  .route("/explore", explore)

export default app
