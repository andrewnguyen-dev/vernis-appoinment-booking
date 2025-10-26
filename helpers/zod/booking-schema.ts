import { z } from "zod";

export const bookingFormSchema = z.object({
  salonSlug: z.string().min(1),
  serviceIds: z.array(z.string()).min(1, "At least one service must be selected"),
  date: z.string(),
  time: z.string(),
  customer: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().optional(),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
    notes: z.string().optional(),
  }),
  totalDuration: z.number().positive(),
  totalPrice: z.number().positive(),
});

export type BookingFormData = z.infer<typeof bookingFormSchema>;
