import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ui/base/ui/alert-dialog"
import { Button } from "@ui/base/ui/button"
import {
  getApiV1ChatOptions,
  getApiV1ChatUnreadCountOptions,
  postApiV1ChatByConversationIdAcceptMutation,
  postApiV1ChatByConversationIdIgnoreMutation,
  putApiV1UserBlockByUsernameMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { useState } from "react"
import { toast } from "sonner"
import type { Conversation } from "@frontends/dashboard/components/chat/types"
import { peerOf } from "@frontends/dashboard/components/chat/types"

/**
 * Accept / Ignore / Block controls shown inline on a pending message request.
 * Block confirms via an AlertDialog, then blocks the sender and ignores the
 * conversation.
 */
function stop(e: { preventDefault: () => void; stopPropagation: () => void }) {
  e.preventDefault()
  e.stopPropagation()
}

export function RequestRowActions({
  conversation,
  currentUserId,
}: {
  conversation: Conversation
  currentUserId: string | undefined
}) {
  const queryClient = useQueryClient()
  const [blockOpen, setBlockOpen] = useState(false)
  const peer = peerOf(conversation, currentUserId)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getApiV1ChatOptions().queryKey })
    void queryClient.invalidateQueries({ queryKey: getApiV1ChatUnreadCountOptions().queryKey })
  }

  const accept = useMutation({
    ...postApiV1ChatByConversationIdAcceptMutation(),
    onSuccess: () => {
      toast.success("Request accepted")
      invalidate()
    },
    onError: () => {
      toast.error("Could not accept request")
    },
  })

  const ignore = useMutation({
    ...postApiV1ChatByConversationIdIgnoreMutation(),
    onSuccess: invalidate,
    onError: () => {
      toast.error("Could not ignore request")
    },
  })

  const block = useMutation({
    ...putApiV1UserBlockByUsernameMutation(),
    onSuccess: () => {
      ignore.mutate({ path: { conversationId: conversation.id } })
      toast.success("User blocked")
    },
    onError: () => {
      toast.error("Could not block user")
    },
  })

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <Button
        size="sm"
        disabled={accept.isPending}
        onClick={(e) => {
          stop(e)
          accept.mutate({ path: { conversationId: conversation.id } })
        }}
      >
        Accept
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={ignore.isPending}
        onClick={(e) => {
          stop(e)
          ignore.mutate({ path: { conversationId: conversation.id } })
        }}
      >
        Ignore
      </Button>
      {peer ? (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={(e) => {
            stop(e)
            setBlockOpen(true)
          }}
        >
          Block
        </Button>
      ) : null}

      <AlertDialog open={blockOpen} onOpenChange={setBlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block u/{peer?.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              They won&apos;t be able to message you, and this request will be removed. You can
              unblock them later from settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={block.isPending || !peer}
              onClick={() => {
                if (peer) block.mutate({ path: { username: peer.username } })
                setBlockOpen(false)
              }}
            >
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
