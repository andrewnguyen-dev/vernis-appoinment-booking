import { notFound } from "next/navigation";
import { getSalonBySlug, getCatalogForSalon } from "@/lib/tenancy";
import { BookingForm } from "./booking-form";

type PageProps = { params: Promise<{ salonSlug: string }> };

export default async function BookPage({ params }: PageProps) {
  const { salonSlug } = await params;
  const salon = await getSalonBySlug(salonSlug);
  if (!salon) return notFound();

  const categories = await getCatalogForSalon(salon.id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-semibold">{salon.name}</h1>
        <p className="text-sm text-muted-foreground">Book your appointment</p>
      </header>

      {categories.length === 0 ? (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No services available yet.</p>
        </div>
      ) : (
        <BookingForm salon={salon} categories={categories} />
      )}
    </main>
  );
}
