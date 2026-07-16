import { Hono } from "hono"
import { RegExpRouter } from "hono/router/reg-exp-router"
import auth from "./auth"
import comment from "./comment"
import commentVote from "./comment-vote"
import community from "./community"
import communityJoinRequest from "./community-join-request"
import communityMember from "./community-member"
import communityRule from "./community-rule"
import explore from "./explore"
import feed from "./feed"
import flair from "./flair"
import history from "./history"
import post from "./post"
import postVote from "./post-vote"
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
  .route("/comment", comment)
  .route("/comment-vote", commentVote)
  .route("/post", post)
  .route("/post-vote", postVote)
  .route("/feed", feed)
  .route("/history", history)

export default app
