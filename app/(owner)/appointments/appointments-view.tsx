"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar, List } from 'lucide-react'
import CalendarDayView from '@/components/appointments/calendar-day-view'
import AppointmentListView from '@/components/appointments/appointment-list-view'
import AppointmentDetailModal from '@/components/appointments/appointment-detail-modal'
import { useRouter } from 'next/navigation'
import type { AppointmentData } from '@/types/appointment'

interface AppointmentsViewProps {
  initialAppointments: AppointmentData[]
  salonName: string
  salonTimeZone: string
}

const AppointmentsView: React.FC<AppointmentsViewProps> = ({
  initialAppointments,
  salonName,
  salonTimeZone,
}) => {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleAppointmentClick = (appointment: AppointmentData) => {
    setSelectedAppointment(appointment)
    setIsModalOpen(true)
  }

  const handleRefreshAppointments = () => {
    // Refresh the page to get updated appointment data
    router.refresh()
    setIsModalOpen(false)
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Appointments</h1>
          <p className="text-gray-600 mt-1">
            Manage upcoming appointments for {salonName}
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-1">
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('calendar')}
            className="flex items-center space-x-2"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Calendar</span>
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="flex items-center space-x-2"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">List</span>
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0">
        {viewMode === 'calendar' ? (
          <CalendarDayView
            selectedDate={selectedDate}
            appointments={initialAppointments}
            onDateChange={setSelectedDate}
            onAppointmentClick={handleAppointmentClick}
          />
        ) : (
          <AppointmentListView
            appointments={initialAppointments}
            onAppointmentClick={handleAppointmentClick}
          />
        )}
      </div>

      {/* Appointment Detail Modal */}
      <AppointmentDetailModal
        appointment={selectedAppointment}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleRefreshAppointments}
        salonTimeZone={salonTimeZone}
      />
    </div>
  )
}

export default AppointmentsView
