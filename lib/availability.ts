import prisma from "@/db";
import { DayOfWeek } from "@prisma/client";

export type TimeSlot = {
  time: string; // "09:00"
  available: boolean;
  reason?: string; // Why it's not available
};

export type AvailabilityOptions = {
  salonId: string;
  date: string; // "2025-09-12"
  durationMinutes: number;
  salonTimeZone: string;
};

// Convert day index (0=Sunday, 1=Monday, etc.) to DayOfWeek enum
function getDayOfWeekEnum(dayIndex: number): DayOfWeek {
  const days: DayOfWeek[] = [
    "SUNDAY",
    "MONDAY", 
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY"
  ];
  return days[dayIndex];
}

// Convert time string "09:00" to minutes since midnight
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Convert minutes since midnight back to time string "09:00"
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Generate all possible 30-minute time slots for a day
function generateTimeSlots(startTime: string, endTime: string, slotMinutes = 30): string[] {
  const slots: string[] = [];
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  for (let minutes = startMinutes; minutes < endMinutes; minutes += slotMinutes) {
    slots.push(minutesToTime(minutes));
  }
  
  return slots;
}

// Check if salon is closed on the given date
async function isSalonClosed(salonId: string, date: Date): Promise<{ closed: boolean; reason?: string }> {
  const closures = await prisma.salonClosure.findMany({
    where: {
      salonId,
      startDate: { lte: date },
      endDate: { gte: date },
    },
  });
  
  if (closures.length > 0) {
    return { closed: true, reason: closures[0].reason || "Salon closed" };
  }
  
  return { closed: false };
}

// Get business hours for a specific day
async function getBusinessHours(salonId: string, dayOfWeek: DayOfWeek) {
  return prisma.businessHours.findUnique({
    where: {
      salonId_dayOfWeek: {
        salonId,
        dayOfWeek,
      },
    },
  });
}

// Get existing appointments that might conflict
async function getExistingAppointments(salonId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return prisma.appointment.findMany({
    where: {
      salonId,
      status: { in: ["BOOKED", "COMPLETED"] }, // Don't consider canceled appointments
      startsAt: { gte: startOfDay, lte: endOfDay },
    },
    select: {
      startsAt: true,
      endsAt: true,
    },
  });
}

// Check if a specific time slot conflicts with existing appointments
function hasTimeConflict(
  proposedStart: Date,
  proposedEnd: Date,
  existingAppointments: { startsAt: Date; endsAt: Date }[]
): boolean {
  return existingAppointments.some(appointment => {
    // Check for overlap: proposed appointment overlaps if it starts before existing ends
    // and ends after existing starts
    return proposedStart < appointment.endsAt && proposedEnd > appointment.startsAt;
  });
}

export async function getAvailableTimeSlots({
  salonId,
  date,
  durationMinutes,
  salonTimeZone,
}: AvailabilityOptions): Promise<TimeSlot[]> {
  // Convert date string to Date object in salon's timezone
  // For now, we'll assume the date is already in the correct timezone
  // In a full implementation, you'd use a library like date-fns-tz
  const targetDate = new Date(date + 'T00:00:00'); // Ensure consistent parsing
  const dayOfWeek = getDayOfWeekEnum(targetDate.getDay());
  
  // Check if salon is closed on this date
  const closureCheck = await isSalonClosed(salonId, targetDate);
  if (closureCheck.closed) {
    return []; // Return empty array if salon is closed
  }
  
  // Get business hours for this day
  const businessHours = await getBusinessHours(salonId, dayOfWeek);
  if (!businessHours || businessHours.isClosed) {
    return []; // Return empty array if no business hours set or salon is closed on this day
  }
  
  // Generate all possible time slots
  const allSlots = generateTimeSlots(businessHours.openTime, businessHours.closeTime);
  
  // Get existing appointments for this date
  const existingAppointments = await getExistingAppointments(salonId, targetDate);
  
  // Check availability for each time slot
  const availableSlots: TimeSlot[] = [];
  
  for (const timeSlot of allSlots) {
    // Create proposed appointment start/end times
    const [hours, minutes] = timeSlot.split(':').map(Number);
    const proposedStart = new Date(targetDate);
    proposedStart.setHours(hours, minutes, 0, 0);
    
    const proposedEnd = new Date(proposedStart);
    proposedEnd.setMinutes(proposedEnd.getMinutes() + durationMinutes);
    
    // Check if appointment would end after business hours
    const proposedEndTime = minutesToTime(proposedEnd.getHours() * 60 + proposedEnd.getMinutes());
    const businessEndMinutes = timeToMinutes(businessHours.closeTime);
    const proposedEndMinutes = timeToMinutes(proposedEndTime);
    
    if (proposedEndMinutes > businessEndMinutes) {
      availableSlots.push({
        time: timeSlot,
        available: false,
        reason: "Appointment would end after business hours",
      });
      continue;
    }
    
    // Check for conflicts with existing appointments
    const hasConflict = hasTimeConflict(proposedStart, proposedEnd, existingAppointments);
    
    availableSlots.push({
      time: timeSlot,
      available: !hasConflict,
      reason: hasConflict ? "Time slot already booked" : undefined,
    });
  }
  
  return availableSlots;
}

// Helper function to get salon capacity (for future use)
export async function getSalonCapacity(salonId: string): Promise<number> {
  const salon = await prisma.salon.findUnique({
    where: { id: salonId },
    select: { capacity: true },
  });
  
  return salon?.capacity || 1; // Default to 1 if not set
}

// Set default business hours for a salon (utility function)
export async function setDefaultBusinessHours(salonId: string) {
  const defaultHours = [
    { dayOfWeek: "MONDAY" as DayOfWeek, openTime: "09:00", closeTime: "17:00" },
    { dayOfWeek: "TUESDAY" as DayOfWeek, openTime: "09:00", closeTime: "17:00" },
    { dayOfWeek: "WEDNESDAY" as DayOfWeek, openTime: "09:00", closeTime: "17:00" },
    { dayOfWeek: "THURSDAY" as DayOfWeek, openTime: "09:00", closeTime: "17:00" },
    { dayOfWeek: "FRIDAY" as DayOfWeek, openTime: "09:00", closeTime: "17:00" },
    { dayOfWeek: "SATURDAY" as DayOfWeek, openTime: "09:00", closeTime: "15:00" },
    { dayOfWeek: "SUNDAY" as DayOfWeek, openTime: "10:00", closeTime: "16:00", isClosed: true },
  ];
  
  for (const hours of defaultHours) {
    await prisma.businessHours.upsert({
      where: {
        salonId_dayOfWeek: {
          salonId,
          dayOfWeek: hours.dayOfWeek,
        },
      },
      update: {},
      create: {
        salonId,
        ...hours,
      },
    });
  }
}
