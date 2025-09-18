"use client"

import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { AppointmentData } from '@/types/appointment'

interface CalendarDayViewProps {
  selectedDate: Date
  appointments: AppointmentData[]
  onDateChange: (date: Date) => void
  onAppointmentClick: (appointment: AppointmentData) => void
}

const CalendarDayView: React.FC<CalendarDayViewProps> = ({
  selectedDate,
  appointments,
  onDateChange,
  onAppointmentClick,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(timer)
  }, [])

  // Generate time slots from 9 AM to 9 PM (12 hours)
  const timeSlots = Array.from({ length: 24 }, (_, index) => {
    const hour = 9 + Math.floor(index / 2)
    const minute = index % 2 === 0 ? 0 : 30
    return { hour, minute, timeString: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}` }
  })

  // Filter appointments for the selected date
  const dayAppointments = appointments.filter(appointment => {
    const appointmentDate = appointment.startsAtLocal
    return appointmentDate.toDateString() === selectedDate.toDateString()
  })

  // Function to check if two appointments overlap
  const appointmentsOverlap = (apt1: AppointmentData, apt2: AppointmentData) => {
    const start1 = apt1.startsAtLocal.getTime()
    const end1 = apt1.endsAtLocal.getTime()
    const start2 = apt2.startsAtLocal.getTime()
    const end2 = apt2.endsAtLocal.getTime()
    
    return start1 < end2 && start2 < end1
  }

  // Function to calculate overlap level for each appointment
  const getAppointmentOverlapLevel = (targetAppointment: AppointmentData) => {
    let overlapLevel = 0
    
    // Sort appointments by start time to determine which comes first
    const sortedAppointments = [...dayAppointments].sort((a, b) => 
      a.startsAtLocal.getTime() - b.startsAtLocal.getTime()
    )
    
    // Find appointments that overlap with the target and start before it
    for (const appointment of sortedAppointments) {
      if (appointment.id === targetAppointment.id) break
      
      if (appointmentsOverlap(appointment, targetAppointment)) {
        overlapLevel++
      }
    }
    
    return overlapLevel
  }

  // Function to calculate position and height for appointments
  const getAppointmentStyle = (appointment: AppointmentData) => {
    const startHour = appointment.startsAtLocal.getHours()
    const startMinute = appointment.startsAtLocal.getMinutes()
    const endHour = appointment.endsAtLocal.getHours()
    const endMinute = appointment.endsAtLocal.getMinutes()

    // Calculate position from 9 AM (each hour = 120px, each 30min slot = 60px)
    const startOffset = (startHour - 9) * 120 + (startMinute / 30) * 60
    const endOffset = (endHour - 9) * 120 + (endMinute / 30) * 60
    const height = endOffset - startOffset

    return {
      top: `${startOffset}px`,
      height: `${Math.max(height, 40)}px`, // Minimum height of 40px
    }
  }

  // Function to calculate current time line position
  const getCurrentTimePosition = () => {
    const currentHour = currentTime.getHours()
    const currentMinute = currentTime.getMinutes()
    
    // Only show the line if current time is within business hours (9 AM - 9 PM)
    if (currentHour < 9 || currentHour >= 21) {
      return null
    }
    
    // Calculate position from 9 AM
    const position = (currentHour - 9) * 120 + (currentMinute / 60) * 120
    return position
  }

  // Check if the selected date is today
  const isToday = selectedDate.toDateString() === currentTime.toDateString()
  const currentTimePosition = isToday ? getCurrentTimePosition() : null

  const goToPreviousDay = () => {
    const previousDay = new Date(selectedDate)
    previousDay.setDate(selectedDate.getDate() - 1)
    onDateChange(previousDay)
  }

  const goToNextDay = () => {
    const nextDay = new Date(selectedDate)
    nextDay.setDate(selectedDate.getDate() + 1)
    onDateChange(nextDay)
  }

  const goToToday = () => {
    onDateChange(new Date())
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with date navigation */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={goToPreviousDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToToday} className="text-sm">
            Today
          </Button>
        </div>
        <h2 className="text-lg font-semibold">
          {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </h2>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto">
        <div className="relative min-h-full">
          {/* Time slots */}
          <div className="absolute left-0 top-0 w-16 sm:w-20">
            {timeSlots.map((slot, index) => (
              <div
                key={index}
                className="h-[60px] border-b border-gray-100 flex items-start justify-end pr-2 pt-1"
              >
                <span className="text-xs text-gray-500 font-medium">
                  {slot.hour > 12 ? `${slot.hour - 12}:${slot.minute.toString().padStart(2, '0')} PM` 
                   : slot.hour === 12 ? `12:${slot.minute.toString().padStart(2, '0')} PM`
                   : `${slot.hour}:${slot.minute.toString().padStart(2, '0')} AM`}
                </span>
              </div>
            ))}
          </div>

          {/* Appointments area */}
          <div className="ml-16 sm:ml-20 relative">
            {/* Grid lines */}
            {timeSlots.map((_, index) => (
              <div
                key={index}
                className="h-[60px] border-b border-gray-100"
              />
            ))}

            {/* Appointments */}
            {dayAppointments.map((appointment) => {
              const appointmentStyle = getAppointmentStyle(appointment)
              const overlapLevel = getAppointmentOverlapLevel(appointment)
              const leftOffset = overlapLevel * 20 + 4 // 20px per overlap + base 4px (left-1)
              
              return (
                <div
                  key={appointment.id}
                  className="absolute z-10 cursor-pointer"
                  style={{
                    top: appointmentStyle.top,
                    height: appointmentStyle.height,
                    left: `${leftOffset}px`,
                    right: '0.25rem', // 1 on mobile, 2 on sm
                    width: `calc(100% - ${leftOffset + 4}px)`, // Subtract left offset + right margin
                  }}
                  onClick={() => onAppointmentClick(appointment)}
                >
                  <div className={`h-full rounded-md border-l-4 px-2 py-1 shadow-sm text-xs ${
                    appointment.status === 'BOOKED' 
                      ? 'bg-green-50 border-green-400 text-green-900' 
                      : appointment.status === 'COMPLETED'
                      ? 'bg-blue-50 border-blue-400 text-blue-900'
                      : 'bg-gray-50 border-gray-400 text-gray-900'
                  }`}>
                    <div className="font-medium truncate">
                      {appointment.client.firstName} {appointment.client.lastName}
                    </div>
                    <div className="text-xs opacity-75 truncate">
                      {format(appointment.startsAtLocal, 'h:mm a')} - {format(appointment.endsAtLocal, 'h:mm a')}
                    </div>
                    {appointment.assignedStaff && (
                      <div className="text-xs opacity-75 truncate mt-1 flex items-center">
                        <div 
                          className="w-2 h-2 rounded-full mr-1" 
                          style={{ backgroundColor: appointment.assignedStaff.color }}
                        />
                        {appointment.assignedStaff.user.name}
                      </div>
                    )}
                    {appointment.items.length > 0 && (
                      <div className="text-xs opacity-75 truncate mt-1">
                        {appointment.items[0].serviceName}
                        {appointment.items.length > 1 && ` +${appointment.items.length - 1} more`}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Current Time Line */}
            {currentTimePosition !== null && (
              <div
                className="absolute left-0 right-0 z-20 flex items-center"
                style={{ top: `${currentTimePosition}px` }}
              >
                {/* Time indicator circle */}
                {/* <div className="w-3 h-3 bg-red-400 rounded-full border-2 border-white shadow-sm -ml-1.5"></div> */}
                {/* Time line */}
                <div className="flex-1 h-0.25 bg-red-500 shadow-sm"></div>
                {/* Current time label */}
                <div className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-md ml-2 font-medium shadow-sm">
                  {format(currentTime, 'h:mm a')}
                </div>
              </div>
            )}

            {/* Empty state for no appointments */}
            {dayAppointments.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <p className="text-sm">No appointments scheduled</p>
                  <p className="text-xs">for this day</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CalendarDayView
