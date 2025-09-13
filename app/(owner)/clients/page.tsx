import { requireOwnerAuth } from "@/lib/auth-utils";

export default async function ClientsPage() {
  // This will redirect to /owner-sign-in if not authenticated or not an owner
  await requireOwnerAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        <p className="text-muted-foreground">
          Manage your client list with contact info and notes
        </p>
      </div>
      
      <div className="rounded-lg border p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Client Management</h2>
          <p className="text-muted-foreground">
            Client list with contact information and notes will be implemented here
          </p>
        </div>
      </div>
    </div>
  )
}
