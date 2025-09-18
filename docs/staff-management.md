# Staff Management System Documentation

## Overview

The staff management system allows salon owners to manage their team members, assign colors for visual identification, and control staff access within the salon. Each staff member has a profile with personal information and a unique color for appointment visualization.

## Key Features

### Staff Profiles
- **Personal Information**: Name, email, phone, and notes
- **Unique Colors**: Each staff member gets a unique color for calendar visualization
- **Active/Inactive Status**: Control which staff can be assigned to appointments
- **Automatic Owner Profiles**: Salon owners automatically get staff profiles when they create a salon

### Owner Capabilities
- Add new staff members to the salon
- Edit staff information and settings
- Change staff colors for better visualization
- Activate/deactivate staff members
- Remove staff from the salon

## Database Schema

### Staff Model
```prisma
model Staff {
  id        String  @id @default(cuid())
  salonId   String
  userId    String
  phone     String?  // Salon-specific phone (optional override)
  color     String  @default("#3B82F6") // Default blue color
  active    Boolean @default(true)
  notes     String?

  salon Salon @relation(fields: [salonId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([salonId, userId])
  @@map("staff")
}
```

### Role System Integration
```prisma
enum Role {
  OWNER
  STAFF
}
```

- **OWNER**: Full access to salon management dashboard
- **STAFF**: Limited access, similar to public users, but with staff profile for appointment assignment

## Staff Management Interface

### Accessing Staff Management
1. Sign in as a salon owner
2. Navigate to the owner dashboard
3. Click on "Staff" in the sidebar menu
4. Access the staff management interface at `/staffs`

### Staff List View
- **Active Staff Table**: Shows currently active staff members
- **Inactive Staff Table**: Shows deactivated staff (if any)
- **Color Indicators**: Visual color swatches for each staff member
- **Staff Information**: Name, email, phone, and status
- **Action Buttons**: Settings button for each staff member

### Adding New Staff
1. Navigate to **Staff Management** in the owner dashboard
2. Click **Add Staff** button
3. Enter the existing user's email address
4. Optionally add phone number and notes
5. System automatically assigns a random color
6. Staff profile is created with active status

**Important**: The staff member must already have a user account in the system. They need to sign up first before they can be added as staff.

### Editing Staff Settings
1. Click the settings icon for any staff member
2. Modify any of the following:
   - Personal information (name, email, phone)
   - Staff color (using color picker or preset colors)
   - Active/inactive status
   - Notes
3. Click "Save Changes" to update

### Staff Colors
The system includes 10 preset colors:
- Blue (#3B82F6)
- Red (#EF4444)
- Green (#10B981)
- Amber (#F59E0B)
- Purple (#8B5CF6)
- Orange (#F97316)
- Cyan (#06B6D4)
- Lime (#84CC16)
- Pink (#EC4899)
- Indigo (#6366F1)

Colors can also be customized using the color picker.

## API and Server Actions

### Available Actions
Located in `/app/actions/staff-management.ts`:

#### `addStaffToSalonAction(salonId, data)`
Adds an existing user as staff to the salon.

**Parameters:**
- `salonId`: The salon ID
- `data`: Object containing email (required), phone (optional), notes (optional)

**Returns:**
- Success object with staff data or error message

**Note:** The user with the provided email must already exist in the system.

#### `updateStaffProfileAction(staffId, data)`
Updates an existing staff member's profile.

**Parameters:**
- `staffId`: The staff profile ID
- `data`: Object containing fields to update (phone, color, active, notes)

**Returns:**
- Success object with updated staff data or error message

#### `removeStaffFromSalonAction(userId, staffId)`
Removes a staff member from the salon.

**Parameters:**
- `userId`: The user ID of the staff member
- `staffId`: The staff profile ID

**Returns:**
- Success object or error message

### Utility Functions
Located in `/lib/staff-utils.ts`:

#### `generateRandomStaffColor()`
Returns a random color from the preset color palette.

#### `getStaffProfile(userId, salonId)`
Retrieves a staff profile for a specific user in a salon.

#### `getSalonStaff(salonId)`
Gets all active staff members for a salon.

#### `createStaffProfile(userId, salonId, data)`
Creates a new staff profile.

#### `updateStaffProfile(staffId, data)`
Updates an existing staff profile.

#### `addStaffToSalon(userId, salonId, userData)`
Adds a user as staff to a salon (creates membership and staff profile).

#### `removeStaffFromSalon(userId, salonId)`
Removes staff from salon (deactivates profile and removes membership).

#### `hasStaffProfile(userId, salonId)`
Checks if a user has an active staff profile in a salon.

## Security and Permissions

### Owner Verification
All staff management actions require:
1. Valid owner authentication
2. Verification that the user owns the target salon
3. Prevention of removing salon owners

### Staff Access Control
- Staff members cannot access the owner dashboard
- Staff members have the same permissions as public users
- Staff profiles are only visible to salon owners

## Integration with Appointments

### Staff Assignment
- Staff members can be assigned to appointments
- Staff colors appear in calendar views for easy identification
- Only active staff members can be assigned to new appointments

### Owner as Staff
- Salon owners automatically get staff profiles
- Owners can assign themselves to appointments
- Owner staff profiles use default blue color (#3B82F6)

## Error Handling

### Common Error Scenarios
1. **Unauthorized Access**: User doesn't own the salon
2. **Duplicate Staff**: User is already a staff member
3. **Staff Not Found**: Invalid staff ID provided
4. **Owner Removal**: Attempting to remove salon owner

### Error Messages
- Clear, user-friendly error messages
- Proper HTTP status codes for API responses
- Form validation for required fields

## Future Enhancements

### Potential Features
1. **Staff Schedules**: Define working hours for each staff member
2. **Staff Permissions**: Granular permissions for different staff levels
3. **Staff Performance**: Track appointments and revenue per staff member
4. **Staff Notifications**: Email/SMS notifications for staff
5. **Staff Availability**: Real-time availability status

### Migration Considerations
- The current system is designed to be extensible
- Adding new roles (MANAGER, LEAD_STYLIST) is straightforward
- Staff profiles can accommodate additional fields as needed

## Testing

### Manual Testing Checklist
- [ ] Owner can access staff management page
- [ ] Add new staff member with all fields
- [ ] Add staff member with minimal fields (name, email only)
- [ ] Edit existing staff information
- [ ] Change staff colors using color picker
- [ ] Change staff colors using preset options
- [ ] Activate/deactivate staff members
- [ ] Remove staff member from salon
- [ ] Verify staff appears in appointments interface
- [ ] Verify owner has staff profile automatically
- [ ] Test error handling for unauthorized access
- [ ] Test error handling for duplicate staff

### Security Testing
- [ ] Non-owners cannot access staff management
- [ ] Users cannot manage staff for salons they don't own
- [ ] Salon owners cannot be removed as staff
- [ ] Proper session validation for all actions

## Troubleshooting

### Common Issues

#### "Staff member not found"
- Verify the staff ID is correct
- Check if the staff member was already removed
- Ensure proper database connection

#### "Unauthorized: You don't own this salon"
- Verify user is signed in as owner
- Check salon ownership in database
- Ensure proper session handling

#### "User is already a member of this salon"
- Check existing memberships for the user
- Verify the email address is correct
- Consider if user was previously staff

### Database Queries
To troubleshoot staff-related issues:

```sql
-- Check staff profiles for a salon
SELECT * FROM staff WHERE salon_id = 'your_salon_id';

-- Check memberships for a user
SELECT * FROM membership WHERE user_id = 'your_user_id';

-- Check salon ownership
SELECT * FROM membership WHERE salon_id = 'your_salon_id' AND role = 'OWNER';
```

---

This staff management system provides a solid foundation for team management within salons while maintaining security and ease of use.
