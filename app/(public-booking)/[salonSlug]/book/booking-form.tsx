"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
};

type Category = {
  id: string;
  name: string;
  services: Service[];
};

type Salon = {
  id: string;
  name: string;
  timeZone: string;
  slug: string;
  logoUrl: string | null;
};

type BookingFormProps = {
  salon: Salon;
  categories: Category[];
};

type BookingStep = "services" | "datetime" | "details";

type TimeSlot = {
  time: string;
  available: boolean;
  reason?: string;
};

export function BookingForm({ salon, categories }: BookingFormProps) {
  const [currentStep, setCurrentStep] = useState<BookingStep>("services");
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [customerDetails, setCustomerDetails] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    notes: "",
  });

  // Calculate total duration and price from selected services
  const selectedServiceData = categories
    .flatMap(cat => cat.services)
    .filter(service => selectedServices.has(service.id));
  
  const totalDuration = selectedServiceData.reduce(
    (sum, service) => sum + service.durationMinutes, 
    0
  );
  const totalPrice = selectedServiceData.reduce(
    (sum, service) => sum + service.priceCents, 
    0
  );

  const handleServiceToggle = (serviceId: string) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedServices(newSelected);
  };

  const canProceedToDateTime = selectedServices.size > 0;
  const canProceedToDetails = canProceedToDateTime && selectedDate && selectedTime;
  const canSubmit = canProceedToDetails && customerDetails.firstName && customerDetails.email;

  // Fetch available time slots when date changes
  const fetchAvailableTimeSlots = useCallback(async () => {
    setLoadingSlots(true);
    try {
      const response = await fetch(
        `/api/salons/${salon.slug}/availability?date=${selectedDate}&duration=${totalDuration}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch availability');
      }
      
      const data = await response.json();
      setAvailableTimeSlots(data.availableSlots || []);
    } catch (error) {
      console.error('Error fetching availability:', error);
      setAvailableTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [salon.slug, selectedDate, totalDuration]);

  useEffect(() => {
    if (selectedDate && totalDuration > 0) {
      fetchAvailableTimeSlots();
    } else {
      setAvailableTimeSlots([]);
      setSelectedTime("");
    }
  }, [selectedDate, totalDuration, fetchAvailableTimeSlots]);

  const formatMoney = (cents: number, currency = "AUD") => {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(cents / 100);
  };

  const handleSubmit = () => {
    // TODO: Implement booking submission
    console.log({
      salonId: salon.id,
      services: Array.from(selectedServices),
      date: selectedDate,
      time: selectedTime,
      customer: customerDetails,
      totalDuration,
      totalPrice,
    });
    alert("Booking submitted! (This is a demo)");
  };

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center space-x-4">
        <div className={`flex items-center space-x-2 ${currentStep === "services" ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === "services" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            1
          </div>
          <span className="text-sm">Services</span>
        </div>
        
        <div className="w-8 h-px bg-border"></div>
        
        <div className={`flex items-center space-x-2 ${currentStep === "datetime" ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === "datetime" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            2
          </div>
          <span className="text-sm">Date & Time</span>
        </div>
        
        <div className="w-8 h-px bg-border"></div>
        
        <div className={`flex items-center space-x-2 ${currentStep === "details" ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === "details" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            3
          </div>
          <span className="text-sm">Details</span>
        </div>
      </div>

      {/* Step 1: Select Services */}
      {currentStep === "services" && (
        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Select Services</h2>
              <p className="text-sm text-muted-foreground">Choose the services you&apos;d like to book</p>
            </div>

            <div className="space-y-6">
              {categories.map((category) => (
                <div key={category.id} className="space-y-3">
                  <h3 className="text-lg font-medium">{category.name}</h3>
                  <div className="space-y-3">
                    {category.services.map((service) => (
                      <div key={service.id} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50">
                        <Checkbox
                          id={service.id}
                          checked={selectedServices.has(service.id)}
                          onCheckedChange={() => handleServiceToggle(service.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <Label htmlFor={service.id} className="text-sm font-medium cursor-pointer">
                            {service.name}
                          </Label>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-muted-foreground">
                              {service.durationMinutes} minutes
                            </span>
                            <span className="text-sm font-semibold">
                              {formatMoney(service.priceCents)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {selectedServices.size > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    Total ({selectedServices.size} service{selectedServices.size > 1 ? 's' : ''})
                  </span>
                  <div className="text-right">
                    <div className="font-semibold">{formatMoney(totalPrice)}</div>
                    <div className="text-muted-foreground">{totalDuration} minutes</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button 
                onClick={() => setCurrentStep("datetime")} 
                disabled={!canProceedToDateTime}
                className="min-w-32"
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Pick Date and Time */}
      {currentStep === "datetime" && (
        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Select Date & Time</h2>
              <p className="text-sm text-muted-foreground">
                Your appointment will take approximately {totalDuration} minutes
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <Label htmlFor="date" className="text-sm font-medium">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="time" className="text-sm font-medium">Time</Label>
                {loadingSlots ? (
                  <div className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm items-center">
                    Loading available times...
                  </div>
                ) : (
                  <select
                    id="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedDate || availableTimeSlots.length === 0}
                  >
                    <option value="">
                      {availableTimeSlots.length === 0 && selectedDate
                        ? "No available times"
                        : "Select time"
                      }
                    </option>
                    {availableTimeSlots.map((slot) => (
                      <option 
                        key={slot.time} 
                        value={slot.time}
                        disabled={!slot.available}
                        title={slot.reason}
                      >
                        {slot.time} {!slot.available ? '(Unavailable)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                {selectedDate && availableTimeSlots.length === 0 && !loadingSlots && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No available times for this date. Please select a different date.
                  </p>
                )}
              </div>
            </div>

            {selectedDate && selectedTime && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Appointment Summary</h4>
                <div className="space-y-1 text-sm">
                  <div>Date: {new Date(selectedDate).toLocaleDateString()}</div>
                  <div>Time: {selectedTime}</div>
                  <div>Duration: {totalDuration} minutes</div>
                  <div>Total: {formatMoney(totalPrice)}</div>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep("services")}
              >
                Back
              </Button>
              <Button 
                onClick={() => setCurrentStep("details")} 
                disabled={!canProceedToDetails}
                className="min-w-32"
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: Enter Details */}
      {currentStep === "details" && (
        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Your Details</h2>
              <p className="text-sm text-muted-foreground">Please provide your contact information</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="firstName" className="text-sm font-medium">
                  First Name *
                </Label>
                <Input
                  id="firstName"
                  value={customerDetails.firstName}
                  onChange={(e) => setCustomerDetails(prev => ({ ...prev, firstName: e.target.value }))}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
                <Input
                  id="lastName"
                  value={customerDetails.lastName}
                  onChange={(e) => setCustomerDetails(prev => ({ ...prev, lastName: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-sm font-medium">
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={customerDetails.email}
                  onChange={(e) => setCustomerDetails(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={customerDetails.phone}
                  onChange={(e) => setCustomerDetails(prev => ({ ...prev, phone: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes" className="text-sm font-medium">Additional Notes</Label>
              <textarea
                id="notes"
                value={customerDetails.notes}
                onChange={(e) => setCustomerDetails(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="mt-1 flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Any special requests or information we should know about..."
              />
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Final Summary</h4>
              <div className="space-y-1 text-sm">
                <div>Services: {selectedServiceData.map(s => s.name).join(", ")}</div>
                <div>Date: {new Date(selectedDate).toLocaleDateString()}</div>
                <div>Time: {selectedTime}</div>
                <div>Duration: {totalDuration} minutes</div>
                <div className="font-semibold">Total: {formatMoney(totalPrice)}</div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep("datetime")}
              >
                Back
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!canSubmit}
                className="min-w-32"
              >
                Book Appointment
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
