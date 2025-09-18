"use client";

import React from 'react';
import { format } from 'date-fns';
import { StaffColorIndicator } from '@/components/staff/staff-color-indicator';
import type { AppointmentData } from '@/types/staff';

interface StaffAppointmentCardProps {
  appointment: AppointmentData;
  onClick?: (appointment: AppointmentData) => void;
}

export function StaffAppointmentCard({ 
  appointment, 
  onClick 
}: StaffAppointmentCardProps) {
  return (
    <div
      className="h-full rounded-md border-l-4 px-2 py-1 shadow-sm text-xs cursor-pointer transition-all hover:shadow-md"
      style={{
        borderLeftColor: appointment.assignedStaff?.color || '#6B7280',
        backgroundColor: appointment.assignedStaff?.color ? 
          `${appointment.assignedStaff.color}15` : '#F9FAFB'
      }}
      onClick={() => onClick?.(appointment)}
    >
      <div className="flex items-center gap-1 mb-1">
        {appointment.assignedStaff && (
          <StaffColorIndicator 
            color={appointment.assignedStaff.color} 
            size="sm" 
          />
        )}
        <div className="font-medium truncate flex-1">
          {appointment.client.firstName} {appointment.client.lastName}
        </div>
      </div>
      
      <div className="text-xs opacity-75 truncate">
        {format(appointment.startsAtLocal, 'h:mm a')} - {format(appointment.endsAtLocal, 'h:mm a')}
      </div>
      
      {appointment.items.length > 0 && (
        <div className="text-xs opacity-75 truncate mt-1">
          {appointment.items[0].serviceName}
          {appointment.items.length > 1 && ` +${appointment.items.length - 1} more`}
        </div>
      )}
      
      {appointment.assignedStaff && (
        <div className="text-xs opacity-60 truncate mt-1 font-medium">
          {appointment.assignedStaff.name}
        </div>
      )}
    </div>
  );
}

interface StaffLegendProps {
  staff: Array<{
    id: string;
    name: string;
    color: string;
    active: boolean;
  }>;
}

export function StaffLegend({ staff }: StaffLegendProps) {
  const activeStaff = staff.filter(s => s.active);

  if (activeStaff.length === 0) {
    return null;
  }

  return (
    <div className="border-t pt-3 mt-3">
      <h4 className="text-sm font-medium text-gray-700 mb-2">Staff Legend</h4>
      <div className="grid grid-cols-2 gap-2">
        {activeStaff.map((staffMember) => (
          <div key={staffMember.id} className="flex items-center gap-2">
            <StaffColorIndicator color={staffMember.color} size="sm" />
            <span className="text-sm text-gray-600 truncate">
              {staffMember.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
