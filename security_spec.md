# Security Specification for Papo Hapo Super App

## 1. Data Invariants
- **Users**: A user can only access and modify their own profile. Only admins can list all users or change roles.
- **Vendors**: Profiles are public, but only the owner can modify them.
- **Products**: Publicly readable. Only the vendor owner can modify products belonging to their vendor.
- **Orders**: A customer can see their own orders. A vendor owner can see orders for their vendor. A rider can see orders assigned to them.
- **Rides**: A customer can see their own rides. A driver can see pending rides or rides assigned to them.
- **Drivers**: Online status and location are public (for customers to find them), but only the driver can update their own status.
- **Messages**: Only participants of a chat can read/write messages in that chat's subcollection.

## 2. The "Dirty Dozen" Payloads (Attack Vectors)

1. **Identity Spoofing (User)**: Attempting to create/update a user profile with a different UID.
2. **Privilege Escalation**: A regular user trying to set their role to `admin` in `users` collection.
3. **Ghost Write (Order)**: Creating an order for another customer.
4. **Price Manipulation**: Updating an order's `totalAmount` to 0 after it's been created.
5. **Unauthorized Status Change**: A customer trying to mark their order as `delivered`.
6. **Ride Hijacking**: A driver trying to accept a ride that's already `in_progress` or assigned to someone else.
7. **Cross-Vendor Access**: A vendor owner trying to update products of another vendor.
8. **PII Leak**: A non-admin trying to list all user documents to scrape emails.
9. **Resource Exhaustion**: Sending a 1MB string as a product name.
10. **Orphaned Message**: Writing a message to a chat the user is not a participant of.
11. **Shadow Update (Driver)**: Trying to set `isVerified: true` on a driver profile via the client SDK.
12. **Future Timestamp**: Setting `createdAt` to a time in the future.

## 3. Test Runner (Conceptual) - firestore.rules.test.ts
```typescript
// This file would be used with @firebase/rules-unit-testing
import { assertFails, assertSucceeds, initializeTestApp, ... } from '@firebase/rules-unit-testing';

// ... (Test logic mapping to the Dirty Dozen)
```
