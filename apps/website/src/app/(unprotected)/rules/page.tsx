export const metadata = { title: "ReadIt Rules" }

const RULES = [
  "Remember the human. ReadIt is a place for creating community and belonging, not for attacking marginalized or vulnerable groups of people.",
  "Abide by community rules. Post authentic content, and don't cheat or engage in content manipulation.",
  "Respect the privacy of others. Instigating harassment or posting others' private information is prohibited.",
  "Do not post or encourage the posting of sexual or suggestive content involving minors.",
  "You don't have to use your real name, but don't impersonate an individual or an entity in a misleading or deceptive manner.",
  "Keep it legal, and avoid posting illegal content or soliciting or facilitating illegal transactions.",
  "Don't spam, and don't break the site or interfere with normal use of ReadIt.",
]

export default function RulesPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-bold">ReadIt Content Policy</h1>
      <p className="text-muted-foreground">
        ReadIt is a vast network of communities created, run, and populated by people like you.
        These rules apply to everyone across ReadIt.
      </p>
      <ol className="flex flex-col gap-4">
        {RULES.map((rule, i) => (
          <li key={rule} className="flex gap-3">
            <span className="font-semibold text-primary">{i + 1}.</span>
            <span className="text-muted-foreground">{rule}</span>
          </li>
        ))}
      </ol>
    </main>
  )
}
