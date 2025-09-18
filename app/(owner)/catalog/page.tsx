import { CatalogManager } from "@/components/catalog/catalog-manager";
import { requireOwnerAuth } from "@/lib/auth-utils";
import { getOwnerCatalog } from "@/lib/catalog";

export default async function CatalogPage() {
  // This will redirect to /owner-sign-in if not authenticated or not an owner
  const session = await requireOwnerAuth();

  try {
    const { categories, uncategorizedServices } = await getOwnerCatalog(session.user.id);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catalog</h1>
          <p className="text-muted-foreground">
            Manage your services and categories
          </p>
        </div>

        <CatalogManager
          categories={categories}
          uncategorizedServices={uncategorizedServices}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading catalog page:", error);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catalog</h1>
          <p className="text-muted-foreground">
            Manage your services and categories
          </p>
        </div>

        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-destructive">
          Failed to load catalog data. Please try again later.
        </div>
      </div>
    );
  }
}
