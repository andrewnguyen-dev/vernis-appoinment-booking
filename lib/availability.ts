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

// Check if a specific time slot conflicts with existing appointments considering salon capacity
async function hasTimeConflict(
  proposedStart: Date,
  proposedEnd: Date,
  existingAppointments: { startsAt: Date; endsAt: Date }[],
  salonId: string
): Promise<boolean> {
  // Get salon capacity
  const capacity = await getSalonCapacity(salonId);
  
  // Create a list of all time points where appointments start or end
  const timePoints: { time: Date; type: 'start' | 'end' }[] = [];
  
  // Add existing appointments
  existingAppointments.forEach(appointment => {
    timePoints.push({ time: appointment.startsAt, type: 'start' });
    timePoints.push({ time: appointment.endsAt, type: 'end' });
  });
  
  // Add proposed appointment
  timePoints.push({ time: proposedStart, type: 'start' });
  timePoints.push({ time: proposedEnd, type: 'end' });
  
  // Sort time points chronologically
  timePoints.sort((a, b) => a.time.getTime() - b.time.getTime());
  
  let currentOverlaps = 0;
  let proposedActive = false;
  
  for (const point of timePoints) {
    if (point.type === 'start') {
      currentOverlaps++;
      if (point.time.getTime() === proposedStart.getTime()) {
        proposedActive = true;
      }
    } else {
      currentOverlaps--;
      if (point.time.getTime() === proposedEnd.getTime()) {
        proposedActive = false;
      }
    }
    
    // Check if we exceed capacity while the proposed appointment is active
    if (proposedActive && currentOverlaps > capacity) {
      return true; // Conflict detected
    }
  }
  
  return false; // No conflict
}

export async function getAvailableTimeSlots({
  salonId,
  date,
  durationMinutes,
  salonTimeZone,
}: AvailabilityOptions): Promise<TimeSlot[]> {
  // Create a date object and get the day of week in the salon's timezone
  const targetDate = new Date(date + 'T12:00:00'); // Use noon to avoid timezone edge cases
  
  // Get the day of week in the salon's timezone
  // Create a date in the salon's timezone and extract day of week
  const salonDateString = targetDate.toLocaleDateString('en-CA', { timeZone: salonTimeZone }); // YYYY-MM-DD format
  const salonDate = new Date(salonDateString + 'T12:00:00');
  const dayOfWeek = getDayOfWeekEnum(salonDate.getDay());
  
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
    const hasConflict = await hasTimeConflict(proposedStart, proposedEnd, existingAppointments, salonId);
    
    availableSlots.push({
      time: timeSlot,
      available: !hasConflict,
      reason: hasConflict ? "Time slot not available (capacity exceeded)" : undefined,
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

// Check if a specific time slot is available for public booking
export async function isTimeSlotAvailable(
  salonId: string,
  date: string,
  time: string, // "09:00"
  durationMinutes: number,
  excludeAppointmentIds?: string[] // Optional: exclude specific appointments from check
): Promise<{ available: boolean; reason?: string; capacityInfo?: { used: number; total: number } }> {
  // Create a date object for the specific time slot
  const [hours, minutes] = time.split(':').map(Number);
  const targetDate = new Date(date + 'T12:00:00');
  const proposedStart = new Date(targetDate);
  proposedStart.setHours(hours, minutes, 0, 0);
  
  const proposedEnd = new Date(proposedStart);
  proposedEnd.setMinutes(proposedEnd.getMinutes() + durationMinutes);
  
  // Get existing appointments for this date
  let existingAppointments = await getExistingAppointments(salonId, targetDate);
  
  // Exclude specific appointments if provided (useful for rescheduling)
  if (excludeAppointmentIds && excludeAppointmentIds.length > 0) {
    // We need to get appointment IDs to filter them out
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const appointmentsWithIds = await prisma.appointment.findMany({
      where: {
        salonId,
        status: { in: ["BOOKED", "COMPLETED"] },
        startsAt: { gte: startOfDay, lte: endOfDay },
        id: { notIn: excludeAppointmentIds }, // Exclude specified appointments
      },
      select: {
        startsAt: true,
        endsAt: true,
      },
    });
    
    existingAppointments = appointmentsWithIds;
  }
  
  // Get salon capacity
  const capacity = await getSalonCapacity(salonId);
  
  // Count concurrent appointments at this time
  const concurrentAppointments = existingAppointments.filter(appointment => {
    return proposedStart < appointment.endsAt && proposedEnd > appointment.startsAt;
  });
  
  const isAvailable = concurrentAppointments.length < capacity;
  
  return {
    available: isAvailable,
    reason: isAvailable ? undefined : "No availability at this time",
    capacityInfo: {
      used: concurrentAppointments.length,
      total: capacity
    }
  };
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
