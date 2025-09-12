"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { formatTimezone } from "@/lib/timezone"

type TimeSlot = {
  time: string;
  available: boolean;
  reason?: string;
};

type AvailabilityCalendarProps = {
  salon: {
    slug: string;
    timeZone: string;
  };
  totalDuration: number;
  onDateTimeSelect: (date: Date | undefined, time: string | null) => void;
  selectedDate?: Date;
  selectedTime?: string;
};

export function AvailabilityCalendar({ 
  salon, 
  totalDuration, 
  onDateTimeSelect,
  selectedDate,
  selectedTime 
}: AvailabilityCalendarProps) {
  const [date, setDate] = React.useState<Date | undefined>(selectedDate);
  const [timeSlot, setTimeSlot] = React.useState<string | null>(selectedTime || null);
  const [availableTimeSlots, setAvailableTimeSlots] = React.useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = React.useState(false);

  // Fetch available time slots when date changes
  const fetchAvailableTimeSlots = React.useCallback(async (selectedDate: Date) => {
    if (!selectedDate || totalDuration === 0) {
      setAvailableTimeSlots([]);
      return;
    }

    setLoadingSlots(true);
    try {
      // Use local date string to avoid timezone conversion issues
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const response = await fetch(
        `/api/salons/${salon.slug}/availability?date=${dateStr}&duration=${totalDuration}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch availability');
      }
      
      const data = await response.json();
      setAvailableTimeSlots(data.availableSlots || []);
    } catch (error) {
      console.error('Error fetching availability:', error);
      setAvailableTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [salon.slug, totalDuration]);

  React.useEffect(() => {
    if (date) {
      fetchAvailableTimeSlots(date);
    } else {
      setAvailableTimeSlots([]);
      setTimeSlot(null);
    }
  }, [date, fetchAvailableTimeSlots]);

  const handleDateSelect = (newDate: Date | undefined) => {
    setDate(newDate);
    setTimeSlot(null); // Reset time when date changes
    onDateTimeSelect(newDate, null);
  };

  const handleTimeSelect = (time: string) => {
    setTimeSlot(time);
    onDateTimeSelect(date, time);
  };

  // Filter out unavailable slots and only show available ones
  const availableSlots = availableTimeSlots.filter(slot => slot.available);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Card className="gap-0 p-0">
      <CardContent className="relative p-0 md:pr-48">
        <div className="p-6">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            defaultMonth={date || new Date()}
            disabled={(date) => date < today}
            showOutsideDays={false}
            className="bg-transparent p-0 [--cell-size:--spacing(10)] md:[--cell-size:--spacing(12)]"
            formatters={{
              formatWeekdayName: (date) => {
                return date.toLocaleString("en-US", { weekday: "short" })
              },
            }}
          />
        </div>
        <div className="no-scrollbar inset-y-0 right-0 flex max-h-72 w-full scroll-pb-6 flex-col gap-4 overflow-y-auto border-t p-6 md:absolute md:max-h-none md:w-48 md:border-t-0 md:border-l">
          {loadingSlots ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Loading available times...
            </div>
          ) : availableSlots.length === 0 && date ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No available times for this date
            </div>
          ) : (
            <div className="grid gap-2">
              {availableSlots.map((slot) => (
                <Button
                  key={slot.time}
                  variant={timeSlot === slot.time ? "default" : "outline"}
                  onClick={() => handleTimeSelect(slot.time)}
                  className="w-full shadow-none"
                  disabled={!slot.available}
                >
                  {slot.time}
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4 border-t px-6 !py-5 md:flex-row">
        <div className="text-sm">
          {date && timeSlot ? (
            <>
              Your appointment is scheduled for{" "}
              <span className="font-medium">
                {date?.toLocaleDateString("en-US", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}{" "}
              </span>
              at <span className="font-medium">{timeSlot}</span>
              <span className="text-muted-foreground">
                {" "}({formatTimezone(salon.timeZone)})
              </span>
              {totalDuration > 0 && (
                <span className="text-muted-foreground">
                  {" "}• {totalDuration} minutes
                </span>
              )}
            </>
          ) : (
            <>
              {totalDuration > 0 
                ? `Select a date and time for your ${totalDuration}-minute appointment.`
                : "Select services first, then choose your appointment time."
              }
            </>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
