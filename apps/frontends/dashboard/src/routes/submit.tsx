import { createFileRoute } from "@tanstack/react-router"
import { SubmitForm } from "@frontends/dashboard/components/SubmitForm"

export const Route = createFileRoute("/submit")({
  component: SubmitPage,
})

function SubmitPage() {
  return <SubmitForm />
}
