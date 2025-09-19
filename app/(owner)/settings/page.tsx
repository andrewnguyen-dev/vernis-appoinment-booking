import { requireOwnerAuth } from "@/lib/auth-utils";
import { SalonSettingsManager } from "@/components/salon/salon-settings-manager";

export default async function SettingsPage() {
  // This will redirect to /owner-sign-in if not authenticated or not an owner
  await requireOwnerAuth();

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Salon Settings</h1>
        <p className="text-muted-foreground">
          Manage your salon&apos;s basic information and configuration
        </p>
      </div>
      
      <SalonSettingsManager />
    </div>
  )
}