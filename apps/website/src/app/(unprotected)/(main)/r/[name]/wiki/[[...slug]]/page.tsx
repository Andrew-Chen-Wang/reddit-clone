import { getCurrentSession } from "@website/lib/auth"
import { buttonVariants } from "@ui/base/ui/button"
import { Card, CardContent } from "@ui/base/ui/card"
import { Markdown } from "@ui/seo-shared/Markdown"
import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchWikiPage } from "@lib/dao/wikiPage/fetch"
import { fetchWikiRevision } from "@lib/dao/wikiRevision/fetch"
import { db } from "@template-nextjs/db"
import Link from "next/link"
import { notFound } from "next/navigation"

const REVISION_LIMIT = 25

export default async function WikiPage({
  params,
}: {
  params: Promise<{ name: string; slug?: string[] }>
}) {
  const { name, slug: slugParts } = await params
  const slug = (slugParts ?? []).join("/")

  const community = await fetchCommunity(db).getOneByName(name, ["id", "name", "visibility"])
  if (!community) notFound()

  const session = await getCurrentSession()
  const view = await getCommunityAuthz(db).canView(
    { id: community.id, visibility: community.visibility },
    session?.user.id ?? null,
  )
  if (!view.ok) notFound()

  const pages = await fetchWikiPage(db).listForCommunity(community.id)

  // The wiki root (and the reserved "/wiki/index" URL, which Next resolves to the
  // root) shows the "index" page content when it exists, reddit-style, with the
  // page list beneath. Falls back to just the page list.
  if (slug === "" || slug === "index") {
    const indexPage = await fetchWikiPage(db).getWithCurrentRevision(community.id, "index")
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">r/{community.name} Wiki</h1>
        {indexPage ? (
          <Card>
            <CardContent className="py-6">
              {indexPage.bodyMd && indexPage.bodyMd.trim() !== "" ? (
                <Markdown content={indexPage.bodyMd} />
              ) : (
                <p className="text-sm text-muted-foreground">This page is empty.</p>
              )}
            </CardContent>
          </Card>
        ) : null}
        {pages.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                This wiki has no pages yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <section className="mt-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pages
            </h2>
            <Card>
              <CardContent className="flex flex-col gap-1 py-4">
                {pages.map((page) => (
                  <Link
                    key={page.id}
                    href={`/r/${community.name}/wiki/${page.slug}`}
                    className="rounded-md px-3 py-2 text-sm hover:bg-accent"
                  >
                    {page.title}
                    <span className="ml-2 text-xs text-muted-foreground">/{page.slug}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    )
  }

  const page = await fetchWikiPage(db).getWithCurrentRevision(community.id, slug)
  if (!page) notFound()

  const revisions = await fetchWikiRevision(db).listForPage(page.id, REVISION_LIMIT)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{page.title}</h1>
        <Link
          href={`/r/${community.name}/wiki`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          All pages
        </Link>
      </div>
      {page.revisionCreatedAt ? (
        <p className="mb-4 text-xs text-muted-foreground">
          Last edited {new Date(page.revisionCreatedAt).toLocaleString()}
          {page.revisionAuthorUsername ? ` by u/${page.revisionAuthorUsername}` : ""}
        </p>
      ) : null}

      <Card>
        <CardContent className="py-6">
          {page.bodyMd && page.bodyMd.trim() !== "" ? (
            <Markdown content={page.bodyMd} />
          ) : (
            <p className="text-sm text-muted-foreground">This page is empty.</p>
          )}
        </CardContent>
      </Card>

      {revisions.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Revision history
          </h2>
          <ul className="flex flex-col gap-1.5">
            {revisions.map((revision) => (
              <li key={revision.id} className="rounded-md border p-2 text-sm">
                <p>{revision.note ?? "Edited"}</p>
                <p className="text-xs text-muted-foreground">
                  {revision.authorUsername ? `u/${revision.authorUsername} · ` : ""}
                  {new Date(revision.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
