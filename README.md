# Reddit Clone

The purpose of this Reddit clone is to democratize creating online forums for certain niches, customizing via forking for your particular community's needs, and easing the deployment of forums from idea/necessity to production. The point is not to start a competitor of Reddit; r/RedditAlternatives, the Fediverse, etc. online forums trying to compete are usually created by techies looking to replace Reddit by offering better features (e.g. UI/UX, data sharing/data ownership), when the real driver of forum growth is the community and how you curate it.

Reddit at its core is a forum designed for discussing within niche communities. Online forums have been around for a long time, but the most populated online forums are coalescing around Reddit's form of threaded comments such as YouTube; as more adopt this style of discussion, it's become the dominant format for online discussions when Reddit's UI/UX has essentially become the native feel.

With the dawn of LLMs, it's become even easier to copy this now dominant forum format. Reddit's most basic functionality is included in this clone. What I advocate readers is to fork this clone and edit it using coding agents like Claude Code to customize to how you want to curate your community.

## What Edits Should I Make to Curate My Community

To begin, think of a community you want to target. In my case, I want to start "To Your Credit", a community dedicated to politikers and policy nerds who want to discuss seriously, can control their emotions, and see the other side. The name is based on the idiom To Your Credit or essentially saying in fairness to your comment.

The reason I chose this is that Reddit is dominated by very progressive individuals who abuse downvoting on Reddit to hide opposing opinions. This causes echo chambers via the upvoting system and dismisses and silences differing opinions. In particular, Reddit voting used to be about how informative a comment was. However, the expansion of Reddit to the most popular online format rendered it more for emotions rather than a curated community with core ideals of how the site should operate.

Now that I've stated my community and enumerated the problems, I want to make my own community. First, I would make a fork of this code base. Secondly, I need to add features that addresses the problems of the community at heart.

Problem 1: Unserious, emotional, or people who are unwilling to listen to other perspectives shouldn't be allowed to participate. The solution: an invite-only system where we verify a user's previous public commentary and certify whether their commenting history attests to their personality and thus a good member of the community. This is a straight steal from Raya, but some notoriously elite discussion circles are like this (e.g. Thiel's political circles, many political circles have invite-only group chats).

Problem 2: Downvoting dismisses viewpoints. Solution: in my fork, I would ask my coding agent to replace the upvote with a "coin" as if one we're giving credit to another person. It could be for making a good comment, or giving credit if it changes your mind. I would replace downvoting with a list of "reasons" for a user to choose from including a comment being poorly written, unsubstantiated such as using poor sources, etc. In my case, Reddit's algorithm still works very well in this system because our upvote/downvote system simply reflects Reddit's original upvote/downvote intent and algorithms.

## Reddit's Downside

Because of how large Reddit's user base became, not only has voting become its more dominant form of "liking" and "disliking" based on emotion instead of Reddit's originally true intent, there is a more sinister thing about large communities in the first place: agreed upon rules and over stretching.

We can skip agreed upon rules because that's been touched on already i.e. voting. But over stretching is different in that the algorithm and features of Reddit are desigend for a broad user base, but many communities may want different features, allow different users in, etc. Those features might include ID verification, elitist entry, multiple voting systems, or in particular a certain algorithm.

Because of how generalized Reddit is, it can't support every community in its best effort. Maybe the best solution for Reddit as a unicorn company is to figure out how to allow communities to specialize in creation, but that makes other features of Reddit, in particular the personalization of the home page and recommendation system, more difficult. For example, changing the voting system (like adding multiple voting types) for one subreddit would make the recommendation system difficult to normalize/reconcile in addition to strange scaling requirements. Thus, the upper bound on Reddit's creativity was reached simply because of financial requirements (i.e. taking as much user attention) and competition to be the largest online discussion forum.

Thus, the only solution is to democratize allowing communities to specialize in technical features that caters to the ideals and needs of the community itself. Democratization of more communities across different domains has its own downsides, namely discovery. This is something the Fediverse tried to solve via democratizing content, but finding community is still difficult, not because there aren't listservs, but because it's time-consuming. It feels like discovering in-person meetups where you have to get the feel whereas a centralized, dominant forum like Reddit already gives you both a large user base and a certain vibe before even an interaction is needed.

# Deployment

The assumption of this codebase is that you're somewhat technical and willing to use a coding agent. Though there's OpenTofu, I personally would deploy with Vercel, Supabase for a free Postgres instance, Neon Redis for our BullMQ worker, and AWS ECS instance for our BullMQ worker itself (BullMQ is an asynchronous background worker service, so it'll run tasks outside a request lifecycle). For search, though we use Elasticsearch during development, for your fork, unless you have a gaming server/spare computer with 8GB of RAM, you should replace the search service with Postgres FTS. If you do have a spare computer to host everything, I recommend deploying everything to there using Tailscale/Zrok in GitHub Actions.

If you have questions on how to deploy, I can give some recommendations based on your budget and whether you have a spare computer. If you have questions on a community reaching scaling issues, feel free to open an issue and Andrew is happy to consult (most likely for free; I'll just send a document of what you should do). Please use the discussion tab.

The codebase is based on https://github.com/Andrew-Chen-Wang/nextjs-spa-split if you want to read more on how the code base is structured and how to deploy the frontend SPAs (and why your deploy-spas.yml is likely failing).

# Contributing

This repository serves to mirror Reddit functionality. Today, it looks a lot like ShadCN, and I'm happy to let someone contribute to make the UI more aligned with Reddit's. I'm not looking for better UI/UX or additional features. The point is to make a standard online forum format, and the most well-known (in the U.S.) is Reddit's.

There are several UI elements that do not reflect Reddit's perfectly (margin, location, etc.), and there may be some features that simply don't exist in the clone. If so, please make a PR. In the PR, the only requirements I have is that you attach a video of your change, before and after, or an image, before and after. Feel free to use a coding agent, but please share the prompt and which one you used.

Here is a list of core functionality designated as not planned, so please don't implement it:

- Awards (all forms)
- Polls post type
- Contest mode
- AutoModerator / Automations / Crowd Control / Safety Filters
- News tab (sidebar is Home/Popular/Explore only)
- Reddit Pro, AMA post type, games/dev-platform, "Ask" AI search button
- Discontinued Reddit features: coins/gold economy, live video (RPAN), Reddit Talk
- Vote fuzzing (display-only anti-gaming; skip)
- Other proposed-but-not-chosen extras (approved as excluded by Andrew):
  - Keyword alerts (notification type for chosen keywords in followed communities)
  - Achievements/badges (user profile trophies, incl. commenter achievement chips like "Top 1% Commenter" next to usernames in comments)
  - Community status emoji (emoji next to community name in header)
  - Community achievements (community-level member badges; General Settings toggle)
  - Chat channels (per-community public chat rooms + Chat Operator mod permission; DMs/group chats remain IN scope)
  - Q&A comment sort's OP-reply weighting (Best/Top/New/Old/Controversial comment sorts remain IN scope)

# License

The license for the code in the repository is Apache 2.0. You can find a copy of the license in [LICENSE](./LICENSE).
