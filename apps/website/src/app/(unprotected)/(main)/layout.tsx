import { AnonSidebar } from "@website/components/AnonSidebar"
import { SiteTopNav } from "@website/components/SiteTopNav"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteTopNav />
      <div className="flex flex-1">
        <AnonSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
