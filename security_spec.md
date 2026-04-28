# Security Specification - Papo Hapo Super App

## Data Invariants
1. A Product must belong to an existing Vendor.
2. An Order must reference a valid Customer and Vendor.
3. Access to Order details is limited to the Customer, the Vendor Owner, the assigned Rider, and Admins.
4. Notifications are private to the recipient user.
5. Users cannot elevate their own roles or privileges.
6. Immutable fields like `createdAt` and `ownerUid` must not be changed after creation.
7. Document IDs must be between 1 and 128 characters and match `^[a-zA-Z0-9_\\-]+$`.

## The "Dirty Dozen" Payloads (Exploit Attempts)

1. **Identity Spoofing**: Creating a vendor profile with `ownerUid` set to another user.
2. **Role Escalation**: Updating a user profile to set `role: 'admin'`.
3. **Shadow Update**: Updating a vendor profile with an extra field `isVerified: true`.
4. **ID Poisoning**: Creating a product with a 2KB long string as the document ID.
5. **PII Leak**: A signed-in user attempting to read the private info of another user.
6. **State Shortcut**: Updating an order status from `pending` directly to `delivered` bypassing intermediate steps.
7. **Resource Poisoning**: Sending a 1MB string into a `description` field.
8. **Orphaned Write**: Creating a product referencing a non-existent vendor.
9. **Timestamp Spoofing**: Sending a client-side timestamp in `createdAt` instead of `serverTimestamp()`.
10. **Query Scrape**: Attempting to list all `notifications` without filtering by `userId`.
11. **Outcome Bypass**: Updating an order `totalAmount` after it has been `accepted`.
12. **Relationship Poisoning**: Adding a member to a vendor staff list when the user is not the owner of that vendor.

## Test Runner (firestore.rules.test.ts)
*(Placeholder: In a full environment, this would be executed via Firebase Emulators)*
The rules will be designed to fail all the above scenarios.
