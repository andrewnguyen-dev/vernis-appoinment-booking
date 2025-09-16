"use client"

import React from 'react'
import { format } from 'date-fns'
import type { AppointmentData } from '@/types/appointment'

interface AppointmentListViewProps {
  appointments: AppointmentData[]
  onAppointmentClick: (appointment: AppointmentData) => void
}

const AppointmentListView: React.FC<AppointmentListViewProps> = ({
  appointments,
  onAppointmentClick,
}) => {
  return (
    <div className="space-y-4">
      {appointments.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No upcoming appointments</h3>
          <p className="text-gray-600">New appointments will appear here.</p>
        </div>
      ) : (
        appointments.map((appointment) => (
          <div
            key={appointment.id}
            className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onAppointmentClick(appointment)}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                {/* Client Info */}
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-lg font-semibold">
                    {appointment.client.firstName} {appointment.client.lastName}
                  </h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    appointment.status === 'BOOKED' 
                      ? 'bg-green-100 text-green-800' 
                      : appointment.status === 'COMPLETED'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {appointment.status}
                  </span>
                </div>

                {/* Contact Info */}
                <div className="text-sm text-gray-600 mb-3 space-y-1">
                  {appointment.client.email && (
                    <div>Email: {appointment.client.email}</div>
                  )}
                  {appointment.client.phone && (
                    <div>Phone: {appointment.client.phone}</div>
                  )}
                </div>

                {/* Services */}
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-gray-900 mb-1">Services:</h4>
                  <div className="space-y-1">
                    {appointment.items.map((item) => (
                      <div key={item.id} className="text-sm text-gray-600 flex justify-between">
                        <span>
                          {item.serviceName} ({item.durationMinutes} min)
                          {item.service?.category?.name && (
                            <span className="text-gray-400 ml-1">
                              - {item.service.category.name}
                            </span>
                          )}
                        </span>
                        <span>${(item.priceCents / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm font-medium text-gray-900 mt-2 text-right">
                    Total: ${appointment.items.reduce((sum, item) => sum + item.priceCents, 0) / 100}
                  </div>
                </div>

                {/* Notes */}
                {appointment.notes && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-gray-900 mb-1">Notes:</h4>
                    <p className="text-sm text-gray-600">{appointment.notes}</p>
                  </div>
                )}

                {/* Created By */}
                {/* {appointment.createdBy && (
                  <div className="text-xs text-gray-500">
                    Created by: {appointment.createdBy.name}
                  </div>
                )} */}
              </div>

              {/* Date & Time */}
              <div className="text-left sm:text-right mt-4 sm:mt-0 sm:ml-6">
                <div className="text-lg font-semibold text-gray-900">
                  {format(appointment.startsAtLocal, 'MMM dd, yyyy')}
                </div>
                <div className="text-sm text-gray-600">
                  {format(appointment.startsAtLocal, 'h:mm a')} - {format(appointment.endsAtLocal, 'h:mm a')}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Duration: {Math.round((appointment.endsAt.getTime() - appointment.startsAt.getTime()) / (1000 * 60))} min
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default AppointmentListView
