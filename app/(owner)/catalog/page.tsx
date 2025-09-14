import { requireOwnerAuth } from "@/lib/auth-utils";
import { CatalogManager } from "@/components/catalog/catalog-manager";

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
      
      <CatalogManager />
    </div>
  )
}
