import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { client } from "./client"
import { ensureIndex } from "./indexBootstrap"
import { deletePost, indexPost, POST_INDEX, postIndexDefinition, searchPosts } from "./postIndex"

const publicId = randomUUID()
const privateId = randomUUID()
const privateCommunityId = randomUUID()
const token = `readitacltest${Date.now()}`

let esAvailable = false

beforeAll(async () => {
  try {
    await client.ping()
    esAvailable = true
  } catch {
    esAvailable = false
    return
  }
  await ensureIndex(postIndexDefinition)
  await indexPost(publicId, {
    title: `Public ${token} announcement`,
    body_text: "",
    type: "text",
    community_id: randomUUID(),
    community_name: "openplace",
    community_visibility: "public",
    author_username: "alice",
    is_nsfw: false,
    score: 5,
    comment_count: 1,
    hot_score: 10,
    created_at: new Date().toISOString(),
  })
  await indexPost(privateId, {
    title: `Private ${token} secret`,
    body_text: "",
    type: "text",
    community_id: privateCommunityId,
    community_name: "hideaway",
    community_visibility: "private",
    author_username: "bob",
    is_nsfw: false,
    score: 5,
    comment_count: 1,
    hot_score: 10,
    created_at: new Date().toISOString(),
  })
  await client.indices.refresh({ index: POST_INDEX })
})

afterAll(async () => {
  if (!esAvailable) return
  await deletePost(publicId)
  await deletePost(privateId)
  await client.indices.refresh({ index: POST_INDEX })
})

describe("searchPosts ACL", () => {
  it("hides private-community posts from an anonymous viewer", async () => {
    if (!esAvailable) return
    const { results } = await searchPosts(token, {
      access: { viewableCommunityIds: [] },
      showMature: true,
      safeSearch: false,
    })
    const ids = results.map((r) => r.id)
    expect(ids).toContain(publicId)
    expect(ids).not.toContain(privateId)
  })

  it("shows private-community posts to a viewer on the allowlist", async () => {
    if (!esAvailable) return
    const { results } = await searchPosts(token, {
      access: { viewableCommunityIds: [privateCommunityId] },
      showMature: true,
      safeSearch: false,
    })
    const ids = results.map((r) => r.id)
    expect(ids).toContain(publicId)
    expect(ids).toContain(privateId)
  })
})
