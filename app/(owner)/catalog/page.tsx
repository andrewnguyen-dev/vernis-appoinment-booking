import { requireOwnerAuth } from "@/lib/auth-utils";

export default async function CatalogPage() {
  // This will redirect to /owner-sign-in if not authenticated or not an owner
  await requireOwnerAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Catalog</h1>
        <p className="text-muted-foreground">
          Manage your services and categories
        </p>
      </div>
      
      <div className="rounded-lg border p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Services & Categories</h2>
          <p className="text-muted-foreground">
            CRUD functionality for services and categories will be implemented here
          </p>
        </div>
      </div>
    </div>
  )
}
