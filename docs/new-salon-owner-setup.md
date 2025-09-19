# New Salon Owner Setup Guide

This document outlines the process for setting up a new salon owner account when they reach out requesting access to the Vernis platform.

## Overview

When a new salon owner contacts you for an account, you'll need to manually create their database records. The owner will then use the "Forgot Password" feature to set their password and access their account.

## Required Information

Before starting, collect the following information from the salon owner:

- **Owner's Full Name** (e.g., "Sarah Johnson")
- **Owner's Email Address** (e.g., "sarah@beautystudio.com")
- **Salon Name** (e.g., "Sarah's Beauty Studio")
- **Desired Salon URL Slug** (e.g., "sarahs-beauty-studio")
- **Salon Location/Timezone** (e.g., "Australia/Sydney")
- **Salon Capacity** (number of chairs/stations, e.g., 5)

## Database Setup Process

### Step 1: Create the Database Records

You'll need to create four related records in the database. Use the following SQL script as a template:

```sql
-- 1. Create User Record
INSERT INTO "user" (
  id,
  name,
  email,
  "emailVerified",
  "createdAt",
  "updatedAt",
  "twoFactorEnabled"
) VALUES (
  gen_random_uuid()::text, -- This will generate a UUID
  'Sarah Johnson', -- Replace with actual owner name
  'sarah@beautystudio.com', -- Replace with actual email
  false, -- They'll verify via password reset
  NOW(),
  NOW(),
  false
);

-- 2. Create Salon Record
INSERT INTO "salon" (
  id,
  name,
  slug,
  "timeZone",
  capacity,
  "hasCompletedOnboarding",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid()::text,
  'Sarah''s Beauty Studio', -- Replace with actual salon name (note the escaped quote)
  'sarahs-beauty-studio', -- Replace with actual slug (must be unique)
  'Australia/Sydney', -- Replace with appropriate timezone
  5, -- Replace with actual capacity
  false, -- Will be set to true after onboarding
  NOW(),
  NOW()
);

-- 3. Create Membership Record (Links User to Salon as OWNER)
INSERT INTO "membership" (
  id,
  "userId",
  "salonId",
  role,
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid()::text,
  (SELECT id FROM "user" WHERE email = 'sarah@beautystudio.com'), -- Get user ID
  (SELECT id FROM "salon" WHERE slug = 'sarahs-beauty-studio'), -- Get salon ID
  'OWNER',
  NOW(),
  NOW()
);

-- 4. Create Staff Profile (Owners are automatically staff members)
INSERT INTO "staff" (
  id,
  "salonId",
  "userId",
  color,
  active,
  notes,
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid()::text,
  (SELECT id FROM "salon" WHERE slug = 'sarahs-beauty-studio'), -- Get salon ID
  (SELECT id FROM "user" WHERE email = 'sarah@beautystudio.com'), -- Get user ID
  '#3B82F6', -- Default blue color
  true,
  'Salon Owner',
  NOW(),
  NOW()
);
```

### Step 2: Verification Queries

After creating the records, verify everything was set up correctly:

```sql
-- Verify the complete setup
SELECT 
  u.name as owner_name,
  u.email as owner_email,
  s.name as salon_name,
  s.slug as salon_slug,
  s.capacity,
  s."hasCompletedOnboarding",
  m.role,
  st.color as staff_color
FROM "user" u
JOIN "membership" m ON u.id = m."userId"
JOIN "salon" s ON m."salonId" = s.id
JOIN "staff" st ON u.id = st."userId" AND s.id = st."salonId"
WHERE u.email = 'sarah@beautystudio.com'; -- Replace with actual email
```

## Post-Setup Instructions for Salon Owner

Once the database setup is complete, provide the following instructions to the salon owner:

### Email Template

```
Subject: Your Vernis Salon Account is Ready!

Hi [Owner Name],

Your Vernis salon booking system account has been created! Here's how to get started:

**Your Account Details:**
- Email: [owner-email]
- Salon: [salon-name]
- Booking URL: https://vernis.app/[salon-slug]

**Next Steps:**

1. **Set Your Password**
   - Go to: https://vernis.app/forgot-password
   - Enter your email: [owner-email]
   - Check your email and follow the reset link
   - Create a secure password

2. **Sign In**
   - Go to: https://vernis.app/owner-sign-in
   - Use your email and new password

3. **Complete Onboarding**
   - After signing in, you'll be guided through the setup process
   - You'll need to configure:
     - Business hours (when you're open for bookings)
     - Service categories (e.g., "Hair", "Nails", "Facial")
     - Services (individual treatments with prices and duration)

4. **Start Taking Bookings!**
   - Once setup is complete, your salon will be live
   - Share your booking link: https://vernis.app/[salon-slug]

Need help? Reply to this email and we'll assist you!

Best regards,
The Vernis Team
```

## Validation Checklist

Before notifying the salon owner, ensure:

- [ ] All four database records were created successfully
- [ ] The salon slug is unique and follows the format (lowercase, hyphens only)
- [ ] The email address is correct and unique
- [ ] The timezone is valid (use standard timezone identifiers)
- [ ] The capacity is a reasonable number (1-100)
- [ ] The verification query returns the expected data

## Common Issues and Solutions

### Issue: "Duplicate key value violates unique constraint"

**Cause:** Email or salon slug already exists in the database.

**Solution:** 
- Check for existing records: `SELECT email FROM "user" WHERE email = 'email@example.com';`
- Check for existing salon: `SELECT slug FROM "salon" WHERE slug = 'salon-slug';`
- Use a different email or modify the slug

### Issue: "Foreign key constraint violation"

**Cause:** Referenced IDs don't exist (usually in membership or staff creation).

**Solution:**
- Ensure the user and salon records were created first
- Double-check the email and slug in the queries
- Verify the IDs exist: `SELECT id FROM "user" WHERE email = 'email@example.com';`

### Issue: Owner can't sign in after password reset

**Cause:** Missing membership or staff records.

**Solution:**
- Verify all four records exist using the verification query
- Check that the membership role is exactly 'OWNER'
- Ensure the staff record is active: `active = true`

## Alternative: Using the Helper Function

If you prefer to use code instead of raw SQL, you can use the helper function in `/lib/salon-setup.ts`:

```typescript
import { createSalonOwner } from "@/lib/salon-setup";

const result = await createSalonOwner({
  userName: "Sarah Johnson",
  userEmail: "sarah@beautystudio.com",
  salonName: "Sarah's Beauty Studio",
  salonSlug: "sarahs-beauty-studio",
  timeZone: "Australia/Sydney",
  capacity: 5
});

if (result.success) {
  console.log("Salon owner created successfully!");
  console.log("User ID:", result.data.user.id);
  console.log("Salon ID:", result.data.salon.id);
} else {
  console.error("Error:", result.error);
}
```

## Security Notes

- Never share database credentials or direct database access
- Always use the "forgot password" flow for initial password setup
- Verify the salon owner's identity before creating accounts
- Keep a record of when accounts were created and for whom

## Support and Troubleshooting

If you encounter issues during setup:

1. Check the database logs for detailed error messages
2. Verify all required fields are present and valid
3. Ensure the database migration was applied successfully
4. Test the login flow in a staging environment first

For questions about this process, refer to the development team or update this documentation as needed.
