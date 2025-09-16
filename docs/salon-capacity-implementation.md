# Salon Capacity Implementation for Public Booking

## Overview

The salon capacity feature has been successfully integrated into the appointment booking system to allow multiple concurrent appointments based on the salon's capacity setting.

## Key Changes Made

### 1. Enhanced Availability Checking (`lib/availability.ts`)

#### Modified `hasTimeConflict` function:
- **Before**: Only checked for any time overlap (binary availability)
- **After**: Considers salon capacity to allow multiple overlapping appointments
- Uses a sweep line algorithm to count concurrent appointments at any point in time
- Returns `true` only when capacity would be exceeded

#### Added `isTimeSlotAvailable` function:
- Provides a simple interface for checking specific time slot availability
- Returns capacity information (`used/total` slots)
- Optimized for public booking scenarios

### 2. Updated Appointment Creation (`app/actions/appointment.ts`)

#### Enhanced conflict checking:
- **Before**: Rejected any overlapping appointment
- **After**: Uses capacity-aware availability checking
- Provides user-friendly error messages with capacity information
- Example: "This time slot is no longer available (2/2 slots filled)"

### 3. Enhanced Availability API (`app/api/salons/[salonSlug]/availability/route.ts`)

#### Added capacity information to responses:
```json
{
  "availableSlots": [...],
  "salonCapacity": 2,
  "salonInfo": {
    "name": "Example Salon",
    "timeZone": "Australia/Sydney"
  }
}
```

## How It Works

### Capacity Logic

1. **Salon Capacity**: Defined in the `Salon` model (defaults to 1 if not set)
2. **Overlap Detection**: Uses time interval overlap checking
3. **Concurrent Counting**: Counts how many appointments are active at any given time
4. **Availability Decision**: Slot is available if current bookings < capacity

### Example Scenarios

#### Scenario 1: Salon with capacity = 2
```
Time Slot: 10:00-11:00
Existing appointments:
- Appointment A: 10:00-11:00 (Alice)
- Appointment B: 10:30-11:30 (Bob)

New booking request: 10:15-11:15 (Charlie)
Result: ❌ UNAVAILABLE (would create 3 concurrent appointments at 10:30-11:00)
```

#### Scenario 2: Salon with capacity = 3
```
Same situation as above
Result: ✅ AVAILABLE (max 3 concurrent appointments allowed)
```

### Time Overlap Algorithm

The system uses a sweep line algorithm:

1. **Collect all time points** where appointments start or end
2. **Sort chronologically** 
3. **Track active count** as we sweep through time
4. **Check capacity** whenever the proposed appointment is active
5. **Return conflict** if capacity exceeded at any point

## Benefits for Public Booking

### For Salon Owners:
- **Maximize bookings**: Fill available capacity instead of blocking overlapping times
- **Flexible scheduling**: Accommodate different service durations
- **Better resource utilization**: Multiple stylists can work simultaneously

### For Customers:
- **More availability**: Time slots don't become unavailable due to partial overlaps
- **Transparent feedback**: Clear information about why slots aren't available
- **Better UX**: Capacity information helps understand busy periods

## Configuration

### Setting Salon Capacity

Salon capacity is stored in the `salon.capacity` field:

```sql
-- Set capacity for a salon
UPDATE salon SET capacity = 3 WHERE id = 'salon-id';

-- Default capacity is 1 (maintains current behavior)
```

### Frontend Integration

The availability calendar automatically uses the enhanced capacity checking:

1. **API calls** include capacity information
2. **Time slot filtering** respects capacity limits  
3. **User feedback** shows capacity status when helpful

## Testing

A comprehensive test file has been created at `examples/capacity-booking-test.ts` that demonstrates:

- Daily availability checking with capacity
- Specific time slot validation
- Booking scenario simulation
- Error handling and user feedback

## Migration Path

The implementation is **backward compatible**:

- **Existing salons**: Default capacity = 1 (current behavior)
- **New salons**: Can set capacity during setup
- **Gradual adoption**: Salons can increase capacity when ready

## Future Enhancements

Potential improvements:
1. **Service-specific capacity**: Different services may have different capacity requirements
2. **Staff scheduling**: Link capacity to available staff members
3. **Real-time updates**: WebSocket-based availability updates
4. **Peak hour management**: Dynamic capacity based on time of day
