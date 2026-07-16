import { Hono } from "hono"
import { RegExpRouter } from "hono/router/reg-exp-router"
import auth from "./auth"
import chat from "./chat"
import comment from "./comment"
import commentAction from "./comment-action"
import commentVote from "./comment-vote"
import community from "./community"
import communityJoinRequest from "./community-join-request"
import communityMember from "./community-member"
import communityRule from "./community-rule"
import communityWidget from "./community-widget"
import customFeed from "./custom-feed"
import wiki from "./wiki"
import explore from "./explore"
import feed from "./feed"
import flair from "./flair"
import history from "./history"
import draft from "./draft"
import media from "./media"
import modLog from "./mod-log"
import modmail from "./modmail"
import notification from "./notification"
import modQueue from "./mod-queue"
import modSavedResponse from "./mod-saved-response"
import modTeam from "./mod-team"
import modUsers from "./mod-users"
import mutedCommunity from "./muted-community"
import postAction from "./post-action"
import removalReason from "./removal-reason"
import report from "./report"
import scheduledPost from "./scheduled-post"
import search from "./search"
import userBlock from "./user-block"
import userFollow from "./user-follow"
import post from "./post"
import postInsights from "./post-insights"
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
  .route("/community-widget", communityWidget)
  .route("/community-join-request", communityJoinRequest)
  .route("/custom-feed", customFeed)
  .route("/wiki", wiki)
  .route("/flair", flair)
  .route("/explore", explore)
  .route("/comment", comment)
  .route("/comment-vote", commentVote)
  .route("/post", post)
  .route("/post-insights", postInsights)
  .route("/post-vote", postVote)
  .route("/feed", feed)
  .route("/history", history)
  .route("/media", media)
  .route("/post-action", postAction)
  .route("/comment-action", commentAction)
  .route("/user-follow", userFollow)
  .route("/user-block", userBlock)
  .route("/muted-community", mutedCommunity)
  .route("/draft", draft)
  .route("/scheduled-post", scheduledPost)
  .route("/search", search)
  .route("/report", report)
  .route("/mod-queue", modQueue)
  .route("/mod-team", modTeam)
  .route("/mod-users", modUsers)
  .route("/mod-log", modLog)
  .route("/mod-saved-response", modSavedResponse)
  .route("/removal-reason", removalReason)
  .route("/chat", chat)
  .route("/modmail", modmail)
  .route("/notification", notification)

export default app
