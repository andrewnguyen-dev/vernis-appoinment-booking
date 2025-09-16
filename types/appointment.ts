export interface AppointmentData {
  id: string
  startsAt: Date
  endsAt: Date
  startsAtLocal: Date
  endsAtLocal: Date
  status: string
  notes?: string | null
  client: {
    id: string
    firstName: string
    lastName: string | null
    email: string | null
    phone: string | null
  }
  items: Array<{
    id: string
    serviceName: string
    priceCents: number
    durationMinutes: number
    sortOrder: number
    service?: {
      id: string
      name: string
      category?: {
        name: string
      } | null
    } | null
  }>
  createdBy?: {
    id: string
    name: string
    email: string
  } | null
}

export interface AppointmentUpdateData {
  status: string
  notes: string
  client: {
    firstName: string
    lastName: string
    email: string
    phone: string
  }
}
