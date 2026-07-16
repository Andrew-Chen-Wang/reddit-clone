import { useMutation } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/base/ui/card"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { Textarea } from "@ui/base/ui/textarea"
import { postApiV1ModmailMutation } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/message-mods/$name")({
  component: MessageModsPage,
})

function MessageModsPage() {
  const { name } = Route.useParams()
  const navigate = useNavigate()
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")

  const send = useMutation({
    ...postApiV1ModmailMutation(),
    onSuccess: () => {
      toast.success("Message sent to the mods of r/" + name)
      void navigate({ to: "/modmail-mine" })
    },
    onError: () => {
      toast.error("Could not send message", {
        description: "You may not be able to message these mods.",
      })
    },
  })

  const canSubmit = subject.trim().length > 0 && body.trim().length > 0 && !send.isPending

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Message the mods of r/{name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="modmail-subject">Subject</Label>
            <Input
              id="modmail-subject"
              placeholder="What's this about?"
              maxLength={200}
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="modmail-body">Message</Label>
            <Textarea
              id="modmail-body"
              placeholder="Write your message…"
              rows={6}
              maxLength={10000}
              value={body}
              onChange={(e) => {
                setBody(e.target.value)
              }}
            />
          </div>
          <div className="flex justify-end">
            <Button
              disabled={!canSubmit}
              onClick={() => {
                send.mutate({
                  body: { communityName: name, subject: subject.trim(), body: body.trim() },
                })
              }}
            >
              {send.isPending ? "Sending…" : "Send"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
