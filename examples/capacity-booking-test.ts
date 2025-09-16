/**
 * Example demonstrating how the salon capacity feature works for public booking
 * 
 * This shows how the system now considers salon capacity when checking availability:
 * - A salon with capacity=2 can have 2 concurrent appointments
 * - Time slots become unavailable when capacity is reached
 * - Users get informative feedback about availability
 */

import { 
  getAvailableTimeSlots, 
  getSalonCapacity, 
  isTimeSlotAvailable 
} from "@/lib/availability";

// Example usage in a booking scenario
async function demonstrateCapacityBooking() {
  const salonId = "example-salon-id";
  const date = "2025-09-20";
  const time = "10:00";
  const durationMinutes = 60;
  const salonTimeZone = "Australia/Sydney";

  // 1. Check overall availability for the day
  console.log("=== Checking Daily Availability ===");
  const dailySlots = await getAvailableTimeSlots({
    salonId,
    date,
    durationMinutes,
    salonTimeZone,
  });

  console.log(`Available time slots for ${date}:`);
  dailySlots.forEach(slot => {
    console.log(`${slot.time}: ${slot.available ? "Available" : "Unavailable"} ${slot.reason || ""}`);
  });

  // 2. Check specific time slot availability with capacity info
  console.log("\n=== Checking Specific Time Slot ===");
  const slotCheck = await isTimeSlotAvailable(
    salonId,
    date,
    time,
    durationMinutes
  );

  console.log(`Time slot ${time} on ${date}:`);
  console.log(`Available: ${slotCheck.available}`);
  if (slotCheck.capacityInfo) {
    console.log(`Capacity: ${slotCheck.capacityInfo.used}/${slotCheck.capacityInfo.total} slots used`);
  }
  if (slotCheck.reason) {
    console.log(`Reason: ${slotCheck.reason}`);
  }

  // 3. Show salon capacity
  console.log("\n=== Salon Capacity Info ===");
  const capacity = await getSalonCapacity(salonId);
  console.log(`Salon can handle ${capacity} concurrent appointments`);

  return {
    dailyAvailability: dailySlots.filter(slot => slot.available).length,
    totalSlots: dailySlots.length,
    specificSlotAvailable: slotCheck.available,
    salonCapacity: capacity,
  };
}

// Example of how this integrates with the booking flow
interface BookingAttempt {
  salonId: string;
  date: string;
  time: string;
  duration: number;
  customerName: string;
}

async function processBookingAttempt(booking: BookingAttempt) {
  console.log(`\n=== Processing Booking for ${booking.customerName} ===`);
  
  // Check availability before creating appointment
  const availability = await isTimeSlotAvailable(
    booking.salonId,
    booking.date,
    booking.time,
    booking.duration
  );

  if (!availability.available) {
    const capacityInfo = availability.capacityInfo;
    const message = capacityInfo 
      ? `Time slot full (${capacityInfo.used}/${capacityInfo.total} slots occupied)`
      : "Time slot not available";
    
    return {
      success: false,
      message,
      suggestedAction: "Please select a different time slot"
    };
  }

  // If available, proceed with booking
  return {
    success: true,
    message: `Booking confirmed for ${booking.customerName}`,
    capacityInfo: availability.capacityInfo
  };
}

// Example scenarios
async function runBookingScenarios() {
  const salonId = "demo-salon";
  const date = "2025-09-20";
  
  const bookings: BookingAttempt[] = [
    { salonId, date, time: "10:00", duration: 60, customerName: "Alice" },
    { salonId, date, time: "10:30", duration: 60, customerName: "Bob" },   // Overlaps with Alice
    { salonId, date, time: "10:00", duration: 30, customerName: "Charlie" }, // Same time as Alice
    { salonId, date, time: "11:00", duration: 60, customerName: "Diana" },   // No overlap
  ];

  console.log("=== Booking Scenarios (Assuming salon capacity = 2) ===");
  
  for (const booking of bookings) {
    const result = await processBookingAttempt(booking);
    console.log(`${booking.customerName} (${booking.time}): ${result.message}`);
  }
}

// Export for testing
export {
  demonstrateCapacityBooking,
  processBookingAttempt,
  runBookingScenarios
};
