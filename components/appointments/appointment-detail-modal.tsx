"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { enAU } from 'date-fns/locale';
import { fromZonedTime } from "date-fns-tz";
import type { PaymentStatus } from "@prisma/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  CalendarIcon,
  ClockIcon,
  UserIcon,
  PhoneIcon,
  MailIcon,
  NotebookIcon,
  Trash2Icon,
  UsersIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  RotateCcwIcon,
} from "lucide-react";
import {
  updateAppointment,
  cancelAppointment,
  updateAppointmentTime,
  getSalonStaff,
  refundAppointmentPayment,
} from "@/app/actions/appointment-management";
import { toast } from "react-hot-toast";
import type { AppointmentData, AppointmentStatus } from "@/types/appointment";

interface StaffMember {
  id: string;
  userId: string;
  color: string;
  active: boolean;
  notes: string | null;
  user: {
    name: string;
  };
}

interface AppointmentDetailModalProps {
  appointment: AppointmentData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void; // Callback to refresh the appointments list
  salonTimeZone?: string; // Add salon timezone for proper time conversion
}

const statusOptions: Array<{ value: AppointmentStatus; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "DECLINED", label: "Declined" },
  { value: "CANCELED", label: "Canceled" },
  { value: "COMPLETED", label: "Completed" },
];

const statusBadgeClasses: Record<AppointmentStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  DECLINED: "bg-red-100 text-red-800",
  CANCELED: "bg-gray-100 text-gray-800",
  COMPLETED: "bg-blue-100 text-blue-800",
};

const statusToastMessages: Record<AppointmentStatus, string> = {
  PENDING: "Appointment marked as pending",
  CONFIRMED: "Appointment confirmed",
  DECLINED: "Appointment declined",
  CANCELED: "Appointment cancelled",
  COMPLETED: "Appointment marked as completed",
};

const paymentStatusStyles: Record<PaymentStatus, { label: string; className: string }> = {
  PAID: { label: "Paid", className: "bg-emerald-100 text-emerald-800" },
  PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
  AUTHORIZED: { label: "Authorised", className: "bg-blue-100 text-blue-800" },
  REFUNDED: { label: "Refunded", className: "bg-amber-100 text-amber-800" },
  FAILED: { label: "Failed", className: "bg-red-100 text-red-800" },
};

function formatCurrency(amountCents?: number | null, currency = "AUD") {
  if (amountCents === null || amountCents === undefined) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `$${(amountCents / 100).toFixed(2)}`;
  }
}

function buildStripeDashboardUrl(payment: AppointmentData["payment"]): string | null {
  if (!payment || payment.provider !== "STRIPE") {
    return null;
  }

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const isLiveMode = publishableKey ? publishableKey.startsWith("pk_live") : false;
  const baseUrl = isLiveMode ? "https://dashboard.stripe.com" : "https://dashboard.stripe.com/test";
  const accountSegment = payment.connectedAccountId ? `/connect/accounts/${encodeURIComponent(payment.connectedAccountId)}` : "";
  const paymentIdentifier = payment.stripePaymentIntentId || payment.stripeChargeId;

  if (paymentIdentifier) {
    return `${baseUrl}${accountSegment}/payments/${encodeURIComponent(paymentIdentifier)}`;
  }

  return `${baseUrl}${accountSegment}`;
}

interface AppointmentFormState {
  status: AppointmentStatus;
  notes: string;
  assignedStaffId: string | null;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  clientPhone: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
}

const emptyFormState: AppointmentFormState = {
  status: "PENDING",
  notes: "",
  assignedStaffId: null,
  clientFirstName: "",
  clientLastName: "",
  clientEmail: "",
  clientPhone: "",
  appointmentDate: "",
  startTime: "",
  endTime: "",
};

const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  appointment,
  isOpen,
  onClose,
  onSave,
  salonTimeZone = "UTC", // Default fallback
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [pendingStatusAction, setPendingStatusAction] = useState<AppointmentStatus | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [formData, setFormData] = useState<AppointmentFormState>(() => ({ ...emptyFormState }));
  const [initialFormData, setInitialFormData] = useState<AppointmentFormState>(() => ({ ...emptyFormState }));

  React.useEffect(() => {
    if (appointment) {
      const nextState: AppointmentFormState = {
        status: appointment.status,
        notes: appointment.notes || "",
        assignedStaffId: appointment.assignedStaff?.id || null,
        clientFirstName: appointment.client.firstName,
        clientLastName: appointment.client.lastName || "",
        clientEmail: appointment.client.email || "",
        clientPhone: appointment.client.phone || "",
        appointmentDate: format(appointment.startsAtLocal, "yyyy-MM-dd"),
        startTime: format(appointment.startsAtLocal, "HH:mm"),
        endTime: format(appointment.endsAtLocal, "HH:mm"),
      };
      setFormData(nextState);
      setInitialFormData(nextState);
    } else {
      setFormData({ ...emptyFormState });
      setInitialFormData({ ...emptyFormState });
    }
  }, [appointment]);

  // Load staff list when modal opens and user starts editing
  useEffect(() => {
    if (isOpen && isEditing && staffList.length === 0) {
      loadStaffList();
    }
  }, [isOpen, isEditing, staffList.length]);

  const loadStaffList = async () => {
    setLoadingStaff(true);
    try {
      const result = await getSalonStaff();
      if (result.success && result.data) {
        setStaffList(result.data);
      } else {
        toast.error("Failed to load staff list");
      }
    } catch (error) {
      console.error("Error loading staff:", error);
      toast.error("Failed to load staff list");
    } finally {
      setLoadingStaff(false);
    }
  };

  if (!appointment) return null;

  const payment = appointment.payment ?? null;
  const paymentStatusBadge = payment ? paymentStatusStyles[payment.status] : null;
  const stripeDashboardUrl = buildStripeDashboardUrl(payment);
  const canRefundPayment = Boolean(payment) && payment?.provider === "STRIPE" && payment?.status === "PAID";
  const paymentCurrency = payment?.currency ?? "AUD";

  const totalPrice = appointment.items.reduce((sum, item) => sum + item.priceCents, 0);
  const totalDuration = appointment.items.reduce((sum, item) => sum + item.durationMinutes, 0);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Check if time has changed
      const originalDate = format(appointment.startsAtLocal, "yyyy-MM-dd");
      const originalStartTime = format(appointment.startsAtLocal, "HH:mm");
      const originalEndTime = format(appointment.endsAtLocal, "HH:mm");

      const timeChanged =
        formData.appointmentDate !== originalDate || formData.startTime !== originalStartTime || formData.endTime !== originalEndTime;

      // If time changed, update appointment time first
      if (timeChanged) {
        // Combine date and time, then convert to UTC for storage
        const startDateTime = fromZonedTime(`${formData.appointmentDate}T${formData.startTime}:00`, salonTimeZone);
        const endDateTime = fromZonedTime(`${formData.appointmentDate}T${formData.endTime}:00`, salonTimeZone);

        const timeResult = await updateAppointmentTime({
          appointmentId: appointment.id,
          startsAt: startDateTime.toISOString(),
          endsAt: endDateTime.toISOString(),
        });

        if (!timeResult.success) {
          toast.error(timeResult.error || "Failed to update appointment time");
          setIsSaving(false);
          return;
        }
      }

      // Update other appointment details
      const result = await updateAppointment({
        appointmentId: appointment.id,
        status: formData.status,
        notes: formData.notes,
        assignedStaffId: formData.assignedStaffId,
        client: {
          firstName: formData.clientFirstName,
          lastName: formData.clientLastName,
          email: formData.clientEmail,
          phone: formData.clientPhone,
        },
      });

      if (result.success) {
        toast.success("Appointment updated successfully");
        setInitialFormData({ ...formData });
        setIsEditing(false);
        onSave?.(); // Refresh the appointments list
      } else {
        toast.error(result.error || "Failed to update appointment");
      }
    } catch (error) {
      console.error("Error saving appointment:", error);
      toast.error("Failed to update appointment");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data
    setFormData({ ...initialFormData });
    setIsEditing(false);
  };

  const handleStatusUpdate = async (nextStatus: AppointmentStatus) => {
    if (formData.status === nextStatus) {
      return;
    }

    setPendingStatusAction(nextStatus);
    setIsSaving(true);
    try {
      const result = await updateAppointment({
        appointmentId: appointment.id,
        status: nextStatus,
        notes: formData.notes,
        assignedStaffId: formData.assignedStaffId,
        client: {
          firstName: formData.clientFirstName,
          lastName: formData.clientLastName,
          email: formData.clientEmail,
          phone: formData.clientPhone,
        },
      });

      if (result.success) {
        toast.success(statusToastMessages[nextStatus]);
        setFormData((prev) => ({
          ...prev,
          status: nextStatus,
        }));
        setInitialFormData((prev) => ({
          ...prev,
          status: nextStatus,
        }));
        setIsEditing(false);
        onSave?.();
      } else {
        toast.error(result.error || "Failed to update appointment");
      }
    } catch (error) {
      console.error("Error updating appointment status:", error);
      toast.error("Failed to update appointment status");
    } finally {
      setIsSaving(false);
      setPendingStatusAction(null);
    }
  };

  const handleCancelAppointment = async () => {
    if (!confirm("Are you sure you want to cancel this appointment?")) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await cancelAppointment(appointment.id);

      if (result.success) {
        toast.success("Appointment cancelled successfully");
        onSave?.(); // Refresh the appointments list
        onClose();
      } else {
        toast.error(result.error || "Failed to cancel appointment");
      }
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast.error("Failed to cancel appointment");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefundPayment = async () => {
    if (!appointment) {
      return;
    }

    if (!canRefundPayment) {
      toast.error("This payment cannot be refunded.");
      return;
    }

    if (!confirm("Confirm refund? This will cancel the appointment and issue a refund in Stripe.")) {
      return;
    }

    setIsRefunding(true);
    try {
      const result = await refundAppointmentPayment({ appointmentId: appointment.id });

      if (result.success) {
        toast.success("Payment refunded and appointment cancelled");
        onSave?.();
        onClose();
      } else {
        toast.error(result.error || "Failed to process refund");
      }
    } catch (error) {
      console.error("Error refunding payment:", error);
      toast.error("Failed to process refund");
    } finally {
      setIsRefunding(false);
    }
  };

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
                  <span className="font-medium">{format(appointment.startsAtLocal, "EEEE, MMMM d, yyyy")}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <ClockIcon className="h-4 w-4 text-gray-500" />
                  <span>
                    {format(appointment.startsAtLocal, "h:mm a")} - {format(appointment.endsAtLocal, "h:mm a")}
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
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as AppointmentStatus })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge className={statusBadgeClasses[formData.status]}>
                {statusOptions.find((option) => option.value === formData.status)?.label ?? formData.status}
              </Badge>
            )}
          </div>

          {/* Payment */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <CreditCardIcon className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-sm">Payment</span>
            </div>

            {payment ? (
              <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
                  {paymentStatusBadge ? (
                    <Badge className={paymentStatusBadge.className}>{paymentStatusBadge.label}</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-700">Unknown</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Amount paid</p>
                    <p className="font-medium">{formatCurrency(payment.amountCents, paymentCurrency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Captured at</p>
                    <p className="font-medium">{payment.capturedAt ? format(new Date(payment.capturedAt), "P p", {locale: enAU}) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Net to salon</p>
                    <p className="font-medium">{formatCurrency(payment.netAmount, paymentCurrency)}</p>
                  </div>
                  {payment.stripeFeeAmount !== null && payment.stripeFeeAmount !== undefined && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Fees</p>
                      <p className="font-medium">{formatCurrency(payment.stripeFeeAmount, paymentCurrency)}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                  {stripeDashboardUrl && (
                    <Button variant="outline" size="sm" asChild className="sm:flex-1">
                      <a
                        href={stripeDashboardUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center space-x-2"
                      >
                        <ExternalLinkIcon className="h-4 w-4" />
                        <span>View in Stripe</span>
                      </a>
                    </Button>
                  )}
                  {canRefundPayment && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleRefundPayment}
                      disabled={isRefunding || isSaving || isDeleting}
                      className="sm:flex-1"
                    >
                      <RotateCcwIcon className="h-4 w-4 mr-2" />
                      {isRefunding ? "Processing refund..." : "Refund payment"}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                No payment has been recorded for this appointment yet.
              </div>
            )}
          </div>

          {/* Staff Assignment */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <UsersIcon className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-sm">Assigned Staff</span>
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {/* Unassigned option */}
                  <Button
                    type="button"
                    variant={formData.assignedStaffId === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({ ...formData, assignedStaffId: null })}
                  >
                    No staff assigned
                  </Button>

                  {/* Staff options or loading skeletons */}
                  {loadingStaff
                    ? // Loading skeletons
                      Array.from({ length: 2 }).map((_, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2 px-3 py-2 border border-gray-200 rounded-md bg-gray-50 animate-pulse"
                        >
                          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                          <div className="h-4 bg-gray-300 rounded w-16"></div>
                        </div>
                      ))
                    : // Actual staff buttons
                      staffList.map((staff) => (
                        <Button
                          key={staff.id}
                          type="button"
                          variant={formData.assignedStaffId === staff.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFormData({ ...formData, assignedStaffId: staff.id })}
                          className="flex items-center space-x-2"
                        >
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: staff.color }} />
                          <span>{staff.user.name}</span>
                        </Button>
                      ))}
                </div>
              </div>
            ) : (
              <div className="py-2">
                {appointment.assignedStaff ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: appointment.assignedStaff.color }} />
                    <span className="text-sm">{appointment.assignedStaff.user.name}</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">No staff assigned</span>
                )}
              </div>
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
                  <p className="text-sm py-2">{formData.clientFirstName}</p>
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
                  <p className="text-sm py-2">{formData.clientLastName || "N/A"}</p>
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
                  <span>{formData.clientEmail || "N/A"}</span>
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
                  <span>{formData.clientPhone || "N/A"}</span>
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
                    {item.service?.category?.name && <span className="text-gray-400 text-xs ml-2">- {item.service.category.name}</span>}
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
              <p className="text-sm py-2 text-gray-600">{formData.notes || "No notes added"}</p>
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
                <Button onClick={handleSave} disabled={isSaving || isRefunding} className="flex-1">
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={isSaving || isRefunding}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex flex-col space-y-2">
                {formData.status === "PENDING" && (
                  <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
                    <Button onClick={() => handleStatusUpdate("CONFIRMED")} disabled={isSaving || isRefunding} className="flex-1">
                      {pendingStatusAction === "CONFIRMED" ? "Confirming..." : "Confirm Appointment"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleStatusUpdate("DECLINED")}
                      disabled={isSaving || isRefunding}
                      className="flex-1"
                    >
                      {pendingStatusAction === "DECLINED" ? "Declining..." : "Decline Appointment"}
                    </Button>
                  </div>
                )}
                <Button onClick={() => setIsEditing(true)} className="w-full" disabled={isRefunding}>
                  Edit Appointment
                </Button>
                {formData.status !== "CANCELED" && formData.status !== "DECLINED" && (
                  <Button variant="destructive" onClick={handleCancelAppointment} disabled={isDeleting || isRefunding} className="w-full">
                    <Trash2Icon className="h-4 w-4 mr-2" />
                    {isDeleting ? "Cancelling..." : "Cancel Appointment"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentDetailModal;
