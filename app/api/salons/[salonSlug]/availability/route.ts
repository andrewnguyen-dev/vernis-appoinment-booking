import { NextRequest } from "next/server";
import { getAvailableTimeSlots } from "@/lib/availability";
import { getSalonBySlug } from "@/lib/tenancy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ salonSlug: string }> }
) {
  const { salonSlug } = await params;
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date");
  const durationMinutes = searchParams.get("duration");

  if (!date || !durationMinutes) {
    return Response.json(
      { error: "Missing required parameters: date and duration" },
      { status: 400 }
    );
  }

  try {
    // Get salon info
    const salon = await getSalonBySlug(salonSlug);
    if (!salon) {
      return Response.json({ error: "Salon not found" }, { status: 404 });
    }

    // Get available time slots
    const availableSlots = await getAvailableTimeSlots({
      salonId: salon.id,
      date,
      durationMinutes: parseInt(durationMinutes),
      salonTimeZone: salon.timeZone,
    });

    return Response.json({ availableSlots });
  } catch (error) {
    console.error("Error fetching availability:", error);
    return Response.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
