"use client"

import { Icons } from "@website/components/icons"
import { Button } from "@ui/base/ui/button"
import { Checkbox } from "@ui/base/ui/checkbox"
import { Label } from "@ui/base/ui/label"
import Link from "next/link"
import { useCallback, useId, useState } from "react"
import { oauthRedirect } from "./actions"

export function SignInForm() {
  const [signInError, setSignInError] = useState<string | null>(null)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const termsId = useId()

  const handleTermsChange = useCallback((checked: boolean) => {
    setAgreedToTerms(checked)
  }, [])

  const handleGoogleClick = useCallback(() => {
    const googleSubmit = async () => {
      if (!agreedToTerms) {
        setSignInError("Please agree to the terms and conditions to continue")
        return
      }
      await oauthRedirect("/login/google")
    }
    googleSubmit().catch(console.error)
  }, [agreedToTerms])

  return (
    <div className="grid gap-6">
      {signInError && (
        <div className="p-4 bg-red-100 text-red-900 rounded-md">Error: {signInError}</div>
      )}

      <div className="flex items-center flex-row gap-x-2 mb-4">
        <Checkbox id={termsId} checked={agreedToTerms} onCheckedChange={handleTermsChange} />
        <Label htmlFor={termsId} className="text-sm">
          <p>
            I agree to the{" "}
            <Link href="/legal/community-terms" className="text-blue-600 hover:underline">
              Terms of Service
            </Link>
            ,{" "}
            <Link href="/legal/privacy-policy" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>
            , and{" "}
            <Link href="/legal/code-of-conduct" className="text-blue-600 hover:underline">
              Community Code of Conduct
            </Link>
          </p>
        </Label>
      </div>

      <Button variant="outline" type="button" disabled={!agreedToTerms} onClick={handleGoogleClick}>
        <Icons.google className="mr-2 h-4 w-4" /> Google
      </Button>
    </div>
  )
}
