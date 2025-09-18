## Authentication & Role-Based Access Control Documentation

## Overview

This project implements a role-based authentication system using Better Auth with support for salon owners and regular customers. The system follows Better Auth best practices for security and performance.

### Key Features
- **Role-based access control** with salon owners and customers
- **Automatic redirects** for already logged-in users visiting sign-in pages
- **Server-side validation** for all protected routes
- **Optimistic middleware** for fast user experience

## Architecture

### 1. Authentication Flow
- **Regular Customers**: Sign in at `/sign-in` to book appointments
- **Salon Owners**: Sign in at `/owner-sign-in` to access management dashboard
- **Session Management**: Handled by Better Auth with secure cookies
- **Auto-redirect**: Already logged-in users are redirected to appropriate pages

### 2. Auto-Redirect Logic
When authenticated users visit auth pages:
- **Owners** → Redirected to `/dashboard`
- **Regular users** → Redirected to `/` (homepage)
- **Not authenticated** → Show sign-in form

### 3. Role System
Based on the `Membership` model in the database:
```prisma
model Membership {
  id      String @id @default(cuid())
  userId  String
  salonId String
  role    Role   // OWNER or STAFF
}

enum Role {
  OWNER
  STAFF
}
```

**Role Permissions:**
- **OWNER**: Full access to salon management dashboard, can manage staff, services, appointments, etc.
- **STAFF**: Similar permissions to public users, cannot access owner dashboard, but has a staff profile with assigned color for appointment visualization

## Implementation Guide

### Adding Authentication to Pages

We provide three utility functions in `/lib/auth-utils.ts`:

#### 1. `requireAuth()` - General Authentication
For pages that require any authenticated user:

```typescript
import { requireAuth } from "@/lib/auth-utils";

export default async function MyProtectedPage() {
  // This will redirect to /sign-in if not authenticated
  const session = await requireAuth();
  
  return (
    <div>
      <h1>Welcome {session.user.name}</h1>
      {/* Your page content */}
    </div>
  );
}
```

#### 2. `requireOwnerAuth()` - Owner-Only Pages
For pages that require salon owner privileges:

```typescript
import { requireOwnerAuth } from "@/lib/auth-utils";

export default async function OwnerOnlyPage() {
  // This will redirect to /owner-sign-in if not authenticated or not an owner
  const session = await requireOwnerAuth();
  
  return (
    <div>
      <h1>Owner Dashboard for {session.user.name}</h1>
      {/* Owner-specific content */}
    </div>
  );
}
```

#### 3. `isStaffOrOwner()` - Staff or Owner Access
For pages that require either staff or owner privileges:

```typescript
import { isStaffOrOwner } from "@/lib/user-utils";

export default async function StaffOrOwnerPage() {
  const session = await requireAuth();
  
  const hasAccess = await isStaffOrOwner(session.user.id, salonId);
  if (!hasAccess) {
    redirect("/sign-in");
  }
  
  return (
    <div>
      <h1>Staff/Owner Content</h1>
      {/* Content accessible to both staff and owners */}
    </div>
  );
}
```

#### 4. `getOptionalAuth()` - Optional Authentication
For pages that work with or without authentication:

```typescript
import { getOptionalAuth } from "@/lib/auth-utils";

export default async function PublicPage() {
  const session = await getOptionalAuth();
  
  return (
    <div>
      {session ? (
        <p>Welcome back, {session.user.name}!</p>
      ) : (
        <p>Please sign in to access personalized features</p>
      )}
      {/* Public content */}
    </div>
  );
}
```

### Creating Auth Pages with Auto-Redirect

For auth pages (sign-in, sign-up) that should redirect already logged-in users:

```typescript
import { getOptionalAuth } from "@/lib/auth-utils";
import { isOwner } from "@/lib/user-utils";
import { redirect } from "next/navigation";

export default async function SignInPage() {
  const session = await getOptionalAuth();
  
  // Auto-redirect logic for already logged-in users
  if (session?.user) {
    const userIsOwner = await isOwner(session.user.id);
    if (userIsOwner) {
      redirect("/dashboard");  // Owners → Dashboard
    } else {
      redirect("/");           // Regular users → Homepage
    }
  }

  return <SignInComponent />;
}
```

### Middleware Configuration

The middleware in `/middleware.ts` handles optimistic redirects:

```typescript
// Only checks for session cookie existence (fast, no DB calls)
export const config = {
  matcher: [
    '/dashboard/:path*',    // Owner routes
    '/catalog/:path*',      // Owner routes
    '/clients/:path*',      // Owner routes
    // Add new protected routes here
  ]
};
```

**To protect new routes:**
1. Add the path pattern to `config.matcher`
2. Use appropriate auth utility in the page component

## Creating New Protected Pages

### Example: Adding a Staff Management Page (Owner Only)

1. **Create the page file:**
```typescript
// app/(owner)/staff/page.tsx
import { requireOwnerAuth } from "@/lib/auth-utils";

export default async function StaffPage() {
  const session = await requireOwnerAuth();
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Staff Management</h1>
      <p>Manage your salon staff here</p>
    </div>
  );
}
```

2. **Update middleware matcher:**
```typescript
// middleware.ts
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/catalog/:path*',
    '/clients/:path*',
    '/staff/:path*',        // Add new route
  ]
};
```

3. **Add navigation (if needed):**
```typescript
// components/owner-sidebar.tsx - add to navigation items
```

### Example: Adding a Profile Page (Any Authenticated User)

```typescript
// app/profile/page.tsx
import { requireAuth } from "@/lib/auth-utils";

export default async function ProfilePage() {
  const session = await requireAuth();
  
  return (
    <div>
      <h1>User Profile</h1>
      <p>Email: {session.user.email}</p>
      <p>Name: {session.user.name}</p>
    </div>
  );
}
```

## Extending the Role System

### Staff Management

The application now includes a comprehensive staff management system:

#### Staff Profiles
- Each staff member has a profile with personal information and settings
- Staff members are assigned unique colors for appointment visualization
- Colors can be customized by salon owners
- Owners automatically get a staff profile when they create a salon

#### Staff Management Features
- **Add Staff**: Owners can add new staff members by email
- **Staff Settings**: Configure staff colors, contact info, and status
- **Active/Inactive Status**: Control which staff can be assigned to appointments
- **Staff Colors**: Visual identification in appointment calendars and schedules

#### Adding New Staff
1. Navigate to **Staff Management** in the owner dashboard
2. Click **Add Staff** button
3. Enter staff member's details (name, email, phone, notes)
4. System automatically assigns a random color
5. Staff profile is created with active status

#### Staff Profile Management
- Owners can update staff information, colors, and status
- Staff members can be deactivated without deletion
- Staff colors help with appointment visualization and scheduling

### Adding New Roles

1. **Update the Prisma schema:**
```prisma
enum Role {
  OWNER
  STAFF
  MANAGER    // New role
}
```

2. **Run migration:**
```bash
npx prisma migrate dev --name add_manager_role
```

3. **Create new auth utilities:**
```typescript
// lib/auth-utils.ts
export async function requireManagerAuth() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    redirect("/sign-in");
  }

  const hasManagerAccess = await hasRole(session.user.id, "MANAGER") || 
                          await hasRole(session.user.id, "OWNER");
  
  if (!hasManagerAccess) {
    redirect("/sign-in");
  }

  return session;
}
```

4. **Use in pages:**
```typescript
export default async function ManagerOnlyPage() {
  const session = await requireManagerAuth();
  // Page content
}
```

## Security Considerations

### ✅ Best Practices Followed

1. **No Database Calls in Middleware**: Only checks session cookie existence
2. **Server-Side Validation**: All auth checks happen server-side
3. **Automatic Redirects**: Users sent to appropriate sign-in pages
4. **Role Verification**: Each protected page validates both authentication and authorization

### ⚠️ Important Security Notes

1. **Always use server-side auth utilities** - Never rely on client-side checks alone
2. **Session validation happens on every request** to protected pages
3. **Role checks are performed fresh** on each page load
4. **Middleware only provides optimistic redirects** - real security is in page components

## API Route Protection

For API routes, use the auth utilities:

```typescript
// app/api/owner-only/route.ts
import { auth } from "@/lib/auth";
import { isOwner } from "@/lib/user-utils";

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userIsOwner = await isOwner(session.user.id);
  if (!userIsOwner) {
    return new Response("Forbidden", { status: 403 });
  }

  // API logic here
}
```

## Testing Authentication

### Testing Auth Flows

1. **Test unauthorized access:**
   - Visit protected routes without signing in
   - Should redirect to appropriate sign-in page

2. **Test role restrictions:**
   - Sign in as regular user, try to access owner routes
   - Should redirect to customer sign-in

3. **Test proper access:**
   - Sign in with correct role
   - Should access protected content

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Unauthorized" errors | Check if auth utility is imported and used correctly |
| Wrong redirect page | Verify you're using the right auth utility (`requireAuth` vs `requireOwnerAuth`) |
| Middleware not working | Check if route is in `config.matcher` |
| Performance issues | Ensure no database calls in middleware |

## File Structure

```
lib/
├── auth.ts              # Better Auth configuration
├── auth-client.ts       # Client-side auth functions
├── auth-utils.ts        # Server-side auth utilities (USE THESE!)
├── user-utils.ts        # Role checking functions
└── staff-utils.ts       # Staff management utilities

app/
├── (auth)/             # Authentication pages
│   ├── sign-in/
│   ├── sign-up/
│   ├── owner-sign-in/
│   └── owner-sign-up/
├── (owner)/            # Owner-only pages
│   ├── dashboard/
│   ├── catalog/
│   ├── clients/
│   └── staffs/         # Staff management
├── actions/
│   └── staff-management.ts  # Server actions for staff management
└── api/
    └── auth/           # Auth API endpoints

components/
└── staff/              # Staff management components
    ├── staff-manager.tsx
    ├── staff-form.tsx
    └── staff-settings-dialog.tsx

middleware.ts           # Route protection (optimistic)
```

## Quick Reference

| Need | Use | Redirects to |
|------|-----|--------------|
| Any authenticated user | `requireAuth()` | `/sign-in` |
| Salon owner only | `requireOwnerAuth()` | `/owner-sign-in` |
| Staff or owner access | `isStaffOrOwner()` | Manual redirect needed |
| Optional auth | `getOptionalAuth()` | No redirect |
| API protection | Manual session check | Return 401/403 |

## Migration Guide

When upgrading or modifying the auth system:

1. Always test all protected routes
2. Update middleware matcher for new routes
3. Run database migrations for role changes
4. Update documentation for new patterns
5. Test both positive and negative access cases

---

**Remember**: Security happens server-side. The middleware is just for user experience - real protection is in your page components using these auth utilities.
