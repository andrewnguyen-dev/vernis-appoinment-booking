import { notFound } from "next/navigation";
import { getSalonBySlug, getCatalogForSalon } from "@/lib/tenancy";

type PageProps = { params: { salonSlug: string } };

export default async function BookPage({ params }: PageProps) {
  const salon = await getSalonBySlug(params.salonSlug);
  if (!salon) return notFound();

  const categories = await getCatalogForSalon(salon.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">{salon.name}</h1>
        <p className="text-sm text-muted-foreground">Book your services</p>
      </header>

      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground">No services available yet.</p>
      )}

      <section className="space-y-8">
        {categories.map((cat) => (
          <div key={cat.id} className="space-y-3">
            <h2 className="text-xl font-medium">{cat.name}</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {cat.services.map((s) => (
                <li key={s.id} className="rounded-2xl border p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.durationMinutes} min
                      </div>
                    </div>
                    <div className="text-right font-semibold">
                      {formatMoney(s.priceCents)}
                    </div>
                  </div>

                  {/* For MVP, add-to-cart button can push to a simple query param based cart */}
                  <form action={`/` /* replace with real action */} className="mt-3">
                    <button
                      type="button"
                      className="rounded-xl border px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => alert("Add to cart coming soon")}
                    >
                      Add
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}

function formatMoney(cents: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(cents / 100);
}
