"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { enAU } from "date-fns/locale";
import { fromZonedTime } from "date-fns-tz";
import type { PaymentKind, PaymentStatus } from "@prisma/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import QRCode from "react-qr-code";
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
  CopyIcon,
} from "lucide-react";
import {
  updateAppointment,
  cancelAppointment,
  updateAppointmentTime,
  getSalonStaff,
  refundAppointmentPayment,
  notifyAppointmentClient,
} from "@/app/actions/appointment-management";
import { chargeAppointmentBalance } from "@/app/actions/appointment-payments";
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

const paymentKindLabels: Record<PaymentKind, string> = {
  BOOKING_DEPOSIT: "Deposit",
  REMAINING_BALANCE: "Remaining balance",
  FULL_PAYMENT: "Full payment",
  SETUP_ONLY: "Card on file",
  OTHER: "Payment",
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
  const [isChargingBalance, setIsChargingBalance] = useState(false);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [pendingStatusAction, setPendingStatusAction] = useState<AppointmentStatus | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [formData, setFormData] = useState<AppointmentFormState>(() => ({ ...emptyFormState }));
  const [initialFormData, setInitialFormData] = useState<AppointmentFormState>(() => ({ ...emptyFormState }));
  const [isSendingClientUpdate, setIsSendingClientUpdate] = useState(false);

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
      setPaymentLinkUrl(null);
    } else {
      setFormData({ ...emptyFormState });
      setInitialFormData({ ...emptyFormState });
      setPaymentLinkUrl(null);
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
  const paymentHistory = appointment.payments ?? (payment ? [payment] : []);
  const totalPaidCents = paymentHistory
    .filter((entry) => entry.status === "PAID" && entry.kind !== "SETUP_ONLY")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const remainingBalanceCents = Math.max(totalPrice - totalPaidCents, 0);
  const sortedPaymentHistory = [...paymentHistory].sort((a, b) => {
    const aDate = a.capturedAt ?? a.createdAt ?? null;
    const bDate = b.capturedAt ?? b.createdAt ?? null;

    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  const handleSave = async (notifyClient = false) => {
    setIsSaving(true);
    setIsSendingClientUpdate(notifyClient);
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
        if (notifyClient) {
          const notifyResult = await notifyAppointmentClient({ appointmentId: appointment.id });
          if (notifyResult.success) {
            toast.success("Changes saved and sent to the client");
          } else {
            toast.error(notifyResult.error || "Changes saved, but we couldn't email the client");
          }
        } else {
          toast.success("Appointment updated successfully");
        }
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
      setIsSendingClientUpdate(false);
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

  const handleChargeRemainingBalance = async () => {
    if (remainingBalanceCents <= 0) {
      toast.success("No remaining balance to charge.");
      return;
    }

    setPaymentLinkUrl(null);
    setIsChargingBalance(true);
    try {
      const result = await chargeAppointmentBalance({ appointmentId: appointment.id });

      if (result.paymentLinkUrl) {
        setPaymentLinkUrl(result.paymentLinkUrl);
        toast.success("Payment link created. Share it with the client to collect the balance.");
        setIsChargingBalance(false);
        return;
      }

      if (result.success && result.payment) {
        toast.success("Remaining balance charged successfully.");
        onSave?.();
        onClose();
        return;
      }

      if (result.requiresAction) {
        toast.error(result.error ?? "Card requires additional authentication. Send the client a payment link instead.");
        return;
      }

      toast.error(result.error ?? "Failed to charge the remaining balance.");
    } catch (error) {
      console.error("Error charging remaining balance:", error);
      toast.error("Failed to charge the remaining balance.");
    } finally {
      setIsChargingBalance(false);
    }
  };

  const handleCopyPaymentLink = async () => {
    if (!paymentLinkUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(paymentLinkUrl);
      toast.success("Payment link copied to clipboard.");
    } catch (error) {
      console.error("Failed to copy payment link:", error);
      toast.error("Could not copy the payment link. Please copy it manually.");
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
              <>
                <Badge className={statusBadgeClasses[formData.status]}>
                  {statusOptions.find((option) => option.value === formData.status)?.label ?? formData.status}
                </Badge>
                {formData.status === "PENDING" && (
                  <div className="flex mt-1 flex-row space-x-2">
                    <Button size="sm" className="px-4" onClick={() => handleStatusUpdate("CONFIRMED")} disabled={isSaving || isRefunding}>
                      {pendingStatusAction === "CONFIRMED" ? "Confirming..." : "Confirm"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-4"
                      onClick={() => handleStatusUpdate("DECLINED")}
                      disabled={isSaving || isRefunding}
                    >
                      {pendingStatusAction === "DECLINED" ? "Declining..." : "Decline"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Payment */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <CreditCardIcon className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-sm">Payment</span>
            </div>

            <div className="rounded-md bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{formatCurrency(totalPrice, paymentCurrency)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Paid so far</span>
                <span className="font-medium">{formatCurrency(totalPaidCents, paymentCurrency)}</span>
              </div>
              <div
                className={`mt-1 flex items-center justify-between ${remainingBalanceCents > 0 ? "text-destructive" : "text-muted-foreground"}`}
              >
                <span>Remaining</span>
                <span className="font-medium">{formatCurrency(remainingBalanceCents, paymentCurrency)}</span>
              </div>
              {/* {depositPayment ? (
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Deposit collected</span>
                  <span>{formatCurrency(depositPayment.amountCents, paymentCurrency)}</span>
                </div>
              ) : null} */}
            </div>

            {paymentLinkUrl ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">Payment link ready</p>
                    <div className="mt-1 flex items-center text-xs text-blue-800">
                      <a
                        href={paymentLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate underline px-3 flex items-center h-9 bg-white border rounded-l"
                        title={paymentLinkUrl}
                      >
                        {paymentLinkUrl.slice(0, 48)}
                        {paymentLinkUrl.length > 48 ? "…" : ""}
                      </a>
                      <div className="px-3 h-9 flex items-center bg-gray-200 hover:bg-gray-200/70 transition-all duration-300 border-r border-y rounded-r cursor-pointer" onClick={handleCopyPaymentLink}>
                        <CopyIcon className="h-3.5 w-3.5" />
                        <span className="sr-only">Copy payment link</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-col items-center gap-2">
                  <div className="rounded-lg border border-white/60 bg-white p-3">
                    <QRCode value={paymentLinkUrl} size={128} style={{ height: "auto", maxWidth: "100%", width: "128px" }} />
                  </div>
                  <p className="text-center text-xs text-blue-800">Or scan to pay the remaining balance.</p>
                </div>
              </div>
            ) : null}

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
                    <p className="font-medium">
                      {payment.capturedAt ? format(new Date(payment.capturedAt), "P p", { locale: enAU }) : "—"}
                    </p>
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

                <div className="flex flex-col flex-wrap gap-2 pt-1 sm:flex-row">
                  {remainingBalanceCents > 0 && (
                    <Button
                      size="sm"
                      onClick={handleChargeRemainingBalance}
                      disabled={isChargingBalance || isSaving || isDeleting}
                      className="sm:flex-1"
                    >
                      {isChargingBalance
                        ? "Loading..."
                        : `Create payment link for remaining balance (${formatCurrency(remainingBalanceCents, paymentCurrency)})`}
                    </Button>
                  )}
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
              <div className="space-y-3">
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                  No payment has been recorded for this appointment yet.
                </div>
            {remainingBalanceCents > 0 && (
              <Button onClick={handleChargeRemainingBalance} disabled={isChargingBalance || isSaving || isDeleting} className="w-full">
                {isChargingBalance
                  ? "Charging balance..."
                  : `Charge remaining (${formatCurrency(remainingBalanceCents, paymentCurrency)})`}
              </Button>
            )}
          </div>
        )}

        {sortedPaymentHistory.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Payment history</span>
              <span className="text-xs text-gray-500">
                {sortedPaymentHistory.length} entr{sortedPaymentHistory.length === 1 ? "y" : "ies"}
              </span>
            </div>

            <div className="space-y-2">
              {sortedPaymentHistory.map((entry) => {
                const badge = paymentStatusStyles[entry.status];
                const timestamp = entry.capturedAt ?? entry.createdAt ?? null;
                const formattedTimestamp = timestamp
                  ? format(new Date(timestamp), "P p", { locale: enAU })
                  : "Pending";

                return (
                  <div
                    key={entry.id}
                    className="rounded-md border border-gray-100 bg-gray-50 p-3 sm:flex sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                        {formatCurrency(entry.amountCents, entry.currency ?? paymentCurrency)}
                        <span className="text-xs text-gray-500">• {paymentKindLabels[entry.kind]}</span>
                      </div>
                      <p className="text-xs text-gray-500">{formattedTimestamp}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-2 sm:mt-0">
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
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
              <div className="flex flex-col space-y-2">
                <Button onClick={() => handleSave(true)} disabled={isSaving || isRefunding} className="w-full">
                  {isSaving && isSendingClientUpdate ? "Saving & Emailing..." : "Save & Email Client"}
                </Button>
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                  <Button
                    variant="secondary"
                    onClick={() => handleSave(false)}
                    disabled={isSaving || isRefunding}
                    className="flex-1"
                  >
                    {isSaving && !isSendingClientUpdate ? "Saving..." : "Save Without Email"}
                  </Button>
                  <Button variant="outline" onClick={handleCancel} disabled={isSaving || isRefunding} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col space-y-2">
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
