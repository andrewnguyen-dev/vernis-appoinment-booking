import React, { useState } from 'react'
import { format } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CalendarIcon, ClockIcon, UserIcon, PhoneIcon, MailIcon, NotebookIcon, Trash2Icon } from 'lucide-react'
import { updateAppointment, cancelAppointment, updateAppointmentTime } from '@/app/actions/appointment-management'
import { toast } from 'react-hot-toast'
import type { AppointmentData } from '@/types/appointment'

interface AppointmentDetailModalProps {
  appointment: AppointmentData | null
  isOpen: boolean
  onClose: () => void
  onSave?: () => void // Callback to refresh the appointments list
  salonTimeZone?: string // Add salon timezone for proper time conversion
}

const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  appointment,
  isOpen,
  onClose,
  onSave,
  salonTimeZone = 'UTC', // Default fallback
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [formData, setFormData] = useState({
    status: '',
    notes: '',
    clientFirstName: '',
    clientLastName: '',
    clientEmail: '',
    clientPhone: '',
    appointmentDate: '',
    startTime: '',
    endTime: '',
  })

  React.useEffect(() => {
    if (appointment) {
      setFormData({
        status: appointment.status,
        notes: appointment.notes || '',
        clientFirstName: appointment.client.firstName,
        clientLastName: appointment.client.lastName || '',
        clientEmail: appointment.client.email || '',
        clientPhone: appointment.client.phone || '',
        appointmentDate: format(appointment.startsAtLocal, 'yyyy-MM-dd'),
        startTime: format(appointment.startsAtLocal, 'HH:mm'),
        endTime: format(appointment.endsAtLocal, 'HH:mm'),
      })
    }
  }, [appointment])

  if (!appointment) return null

  const totalPrice = appointment.items.reduce((sum, item) => sum + item.priceCents, 0)
  const totalDuration = appointment.items.reduce((sum, item) => sum + item.durationMinutes, 0)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Check if time has changed
      const originalDate = format(appointment.startsAtLocal, 'yyyy-MM-dd')
      const originalStartTime = format(appointment.startsAtLocal, 'HH:mm')
      const originalEndTime = format(appointment.endsAtLocal, 'HH:mm')
      
      const timeChanged = 
        formData.appointmentDate !== originalDate ||
        formData.startTime !== originalStartTime ||
        formData.endTime !== originalEndTime

      // If time changed, update appointment time first
      if (timeChanged) {
        // Combine date and time, then convert to UTC for storage
        const startDateTime = fromZonedTime(
          `${formData.appointmentDate}T${formData.startTime}:00`,
          salonTimeZone
        )
        const endDateTime = fromZonedTime(
          `${formData.appointmentDate}T${formData.endTime}:00`,
          salonTimeZone
        )

        const timeResult = await updateAppointmentTime({
          appointmentId: appointment.id,
          startsAt: startDateTime.toISOString(),
          endsAt: endDateTime.toISOString(),
        })

        if (!timeResult.success) {
          toast.error(timeResult.error || 'Failed to update appointment time')
          setIsSaving(false)
          return
        }
      }

      // Update other appointment details
      const result = await updateAppointment({
        appointmentId: appointment.id,
        status: formData.status as "BOOKED" | "COMPLETED" | "CANCELED",
        notes: formData.notes,
        client: {
          firstName: formData.clientFirstName,
          lastName: formData.clientLastName,
          email: formData.clientEmail,
          phone: formData.clientPhone,
        },
      })

      if (result.success) {
        toast.success('Appointment updated successfully')
        setIsEditing(false)
        onSave?.() // Refresh the appointments list
      } else {
        toast.error(result.error || 'Failed to update appointment')
      }
    } catch (error) {
      console.error('Error saving appointment:', error)
      toast.error('Failed to update appointment')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    // Reset form data
    setFormData({
      status: appointment.status,
      notes: appointment.notes || '',
      clientFirstName: appointment.client.firstName,
      clientLastName: appointment.client.lastName || '',
      clientEmail: appointment.client.email || '',
      clientPhone: appointment.client.phone || '',
      appointmentDate: format(appointment.startsAtLocal, 'yyyy-MM-dd'),
      startTime: format(appointment.startsAtLocal, 'HH:mm'),
      endTime: format(appointment.endsAtLocal, 'HH:mm'),
    })
    setIsEditing(false)
  }

  const handleCancelAppointment = async () => {
    if (!confirm('Are you sure you want to cancel this appointment?')) {
      return
    }

    setIsDeleting(true)
    try {
      const result = await cancelAppointment(appointment.id)

      if (result.success) {
        toast.success('Appointment cancelled successfully')
        onSave?.() // Refresh the appointments list
        onClose()
      } else {
        toast.error(result.error || 'Failed to cancel appointment')
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error)
      toast.error('Failed to cancel appointment')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Appointment Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date & Time */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-sm">Date & Time</span>
            </div>
            
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="appointmentDate">Date</Label>
                  <Input
                    id="appointmentDate"
                    type="date"
                    value={formData.appointmentDate}
                    onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-sm">
                  <span className="font-medium">
                    {format(appointment.startsAtLocal, 'EEEE, MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <ClockIcon className="h-4 w-4 text-gray-500" />
                  <span>
                    {format(appointment.startsAtLocal, 'h:mm a')} - {format(appointment.endsAtLocal, 'h:mm a')}
                  </span>
                  <span className="text-gray-500">({totalDuration} min)</span>
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            {isEditing ? (
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOOKED">Booked</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge className={`${
                appointment.status === 'BOOKED' 
                  ? 'bg-green-100 text-green-800' 
                  : appointment.status === 'COMPLETED'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {appointment.status}
              </Badge>
            )}
          </div>

          {/* Client Information */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <UserIcon className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-sm">Client Information</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                {isEditing ? (
                  <Input
                    id="firstName"
                    value={formData.clientFirstName}
                    onChange={(e) => setFormData({ ...formData, clientFirstName: e.target.value })}
                  />
                ) : (
                  <p className="text-sm py-2">{appointment.client.firstName}</p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                {isEditing ? (
                  <Input
                    id="lastName"
                    value={formData.clientLastName}
                    onChange={(e) => setFormData({ ...formData, clientLastName: e.target.value })}
                  />
                ) : (
                  <p className="text-sm py-2">{appointment.client.lastName || 'N/A'}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              {isEditing ? (
                <Input
                  id="email"
                  type="email"
                  value={formData.clientEmail}
                  onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                />
              ) : (
                <div className="flex items-center space-x-2 text-sm py-2">
                  <MailIcon className="h-3 w-3 text-gray-500" />
                  <span>{appointment.client.email || 'N/A'}</span>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              {isEditing ? (
                <Input
                  id="phone"
                  value={formData.clientPhone}
                  onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                />
              ) : (
                <div className="flex items-center space-x-2 text-sm py-2">
                  <PhoneIcon className="h-3 w-3 text-gray-500" />
                  <span>{appointment.client.phone || 'N/A'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Services */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Services</h4>
            <div className="space-y-2">
              {appointment.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">{item.serviceName}</span>
                    <span className="text-gray-500 ml-2">({item.durationMinutes} min)</span>
                    {item.service?.category?.name && (
                      <span className="text-gray-400 text-xs ml-2">
                        - {item.service.category.name}
                      </span>
                    )}
                  </div>
                  <span className="font-medium">${(item.priceCents / 100).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center text-sm font-semibold pt-2 border-t">
                <span>Total</span>
                <span>${(totalPrice / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <NotebookIcon className="h-4 w-4 text-gray-500" />
              <Label htmlFor="notes">Notes</Label>
            </div>
            {isEditing ? (
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add notes about this appointment..."
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            ) : (
              <p className="text-sm py-2 text-gray-600">
                {appointment.notes || 'No notes added'}
              </p>
            )}
          </div>

          {/* Created By */}
          {/* {appointment.createdBy && (
            <div className="text-xs text-gray-500 pt-2 border-t">
              Created by: {appointment.createdBy.name}
            </div>
          )} */}

          {/* Action Buttons */}
          <div className="flex flex-col space-y-2 pt-4">
            {isEditing ? (
              <div className="flex space-x-2">
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="flex-1"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex flex-col space-y-2">
                <Button onClick={() => setIsEditing(true)} className="w-full">
                  Edit Appointment
                </Button>
                {appointment.status !== 'CANCELED' && (
                  <Button 
                    variant="destructive" 
                    onClick={handleCancelAppointment}
                    disabled={isDeleting}
                    className="w-full"
                  >
                    <Trash2Icon className="h-4 w-4 mr-2" />
                    {isDeleting ? 'Cancelling...' : 'Cancel Appointment'}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AppointmentDetailModal
