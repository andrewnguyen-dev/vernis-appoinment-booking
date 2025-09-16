"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar, List } from 'lucide-react'
import CalendarDayView from './calendar-day-view'
import AppointmentListView from './appointment-list-view'
import AppointmentDetailModal from './appointment-detail-modal'
import type { AppointmentData } from '@/types/appointment'

interface AppointmentsPageClientProps {
  initialAppointments: AppointmentData[]
  salonName: string
}

const AppointmentsPageClient: React.FC<AppointmentsPageClientProps> = ({
  initialAppointments,
  salonName,
}) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleAppointmentClick = (appointment: AppointmentData) => {
    setSelectedAppointment(appointment)
    setIsModalOpen(true)
  }

  const handleAppointmentSaved = () => {
    // Callback to refresh appointments list after save
    // In a real app, this would refetch the appointments from the server
    console.log('Appointment saved, refreshing list...')
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
        onSave={handleAppointmentSaved}
      />
    </div>
  )
}

export default AppointmentsPageClient
