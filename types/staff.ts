export interface AppointmentData {
  id: string;
  startsAt: Date;
  endsAt: Date;
  startsAtLocal: Date;
  endsAtLocal: Date;
  status: 'BOOKED' | 'CANCELED' | 'COMPLETED';
  notes: string | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
  items: {
    id: string;
    serviceName: string;
    priceCents: number;
    durationMinutes: number;
  }[];
  // New field for staff assignment
  assignedStaff?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  color: string;
  active: boolean;
}
