import { NextRequest } from "next/server";
import { getAvailableTimeSlots, getSalonCapacity } from "@/lib/availability";
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

    // Get salon capacity for context
    const salonCapacity = await getSalonCapacity(salon.id);

    return Response.json({ 
      availableSlots,
      salonCapacity,
      salonInfo: {
        name: salon.name,
        timeZone: salon.timeZone
      }
    });
  } catch (error) {
    console.error("Error fetching availability:", error);
    return Response.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
