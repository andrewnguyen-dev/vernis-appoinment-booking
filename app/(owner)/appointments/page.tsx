import React from 'react'
import { requireOwnerAuth } from '@/lib/auth-utils'
import { getUserSalons } from '@/lib/user-utils'
import prisma from '@/db'
import { toZonedTime } from 'date-fns-tz'
import AppointmentsView from '@/app/(owner)/appointments/appointments-view'
import type { AppointmentData } from '@/types/appointment'

async function getUpcomingAppointments(salonId: string, salonTimeZone: string): Promise<AppointmentData[]> {
  // const now = new Date()
  
  const appointments = await prisma.appointment.findMany({
    where: {
      salonId: salonId,
      // startsAt: {
      //   gte: now, // Only upcoming appointments
      // },
      status: {
        in: ['BOOKED', 'COMPLETED', 'CANCELED'], // Exclude cancelled
      },
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      assignedStaff: {
        select: {
          id: true,
          userId: true,
          color: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      items: {
        include: {
          service: {
            select: {
              id: true,
              name: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          sortOrder: 'asc',
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      startsAt: 'asc',
    },
  })

  // Convert appointment times to salon timezone for display
  return appointments.map(appointment => ({
    ...appointment,
    startsAtLocal: toZonedTime(appointment.startsAt, salonTimeZone),
    endsAtLocal: toZonedTime(appointment.endsAt, salonTimeZone),
  }))
}

const AppointmentsPage = async () => {
  // Ensure user is authenticated and has owner role
  const session = await requireOwnerAuth()
  
  // Get user's salons (assuming owner has one salon for now)
  const salons = await getUserSalons(session.user.id, 'OWNER')
  
  if (salons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h1 className="text-2xl font-bold mb-4">No Salon Found</h1>
        <p className="text-gray-600">You don&apos;t have any salon associated with your account.</p>
      </div>
    )
  }

  // For now, use the first salon (in a multi-salon setup, this would be from URL params or selection)
  const salon = salons[0]
  
  // Fetch upcoming appointments
  const appointments = await getUpcomingAppointments(salon.id, salon.timeZone)

  return (
    <AppointmentsView
      initialAppointments={appointments}
      salonName={salon.name}
      salonTimeZone={salon.timeZone}
    />
  )
}

export default AppointmentsPage