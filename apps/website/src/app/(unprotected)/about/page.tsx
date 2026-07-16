import Link from "next/link"

export const metadata = { title: "About ReadIt" }

export default function AboutPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-bold">About ReadIt</h1>
      <p className="text-muted-foreground">
        ReadIt is a community-powered forum where people dive into their interests, share what they
        know, and talk with others who care about the same things. Create communities, post text,
        links, images, and video, vote on what matters, and join threaded conversations that go as
        deep as you do.
      </p>
      <p className="text-muted-foreground">
        Communities are created and run by the people who use them. Moderators set the rules, curate
        the culture, and keep discussions healthy — from the front page to the deepest comment
        thread.
      </p>
      <div className="flex gap-4">
        <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">
          Browse popular posts
        </Link>
        <Link
          href="/explore"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Explore communities
        </Link>
      </div>
    </main>
  )
}
