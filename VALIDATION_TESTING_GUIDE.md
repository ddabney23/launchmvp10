# Validation Testing Guide

**Status**: ✅ All API routes have Zod validation implemented  
**Date**: 2024  
**Testing Priority**: HIGH - Required before production deployment

---

## Overview

All critical API routes now have **Zod schema validation** to ensure:
- ✅ Type safety (strings, numbers, UUIDs, dates)
- ✅ Required field enforcement
- ✅ Max length validation
- ✅ Enum validation (specific allowed values)
- ✅ Format validation (emails, URLs, UUIDs)

---

## Routes with Validation

### 1. Comments API
**Route**: `POST /api/posts/[id]/comments`  
**Schema**: `CommentCreateSchema` (without `post_id`)

```typescript
{
  content: string (min: 1, max: 1000),
  parent_id?: string | null (UUID format)
}
```

**Valid Test Request**:
```json
POST /api/posts/123e4567-e89b-12d3-a456-426614174000/comments
{
  "content": "Great post!",
  "parent_id": null
}
```

**Invalid Test Cases**:
```json
// Missing required field
{ "parent_id": null }
// Expected: 400 - "content is required"

// Content too long
{ "content": "x".repeat(1001) }
// Expected: 400 - "String must contain at most 1000 character(s)"

// Invalid UUID
{ "content": "Nice!", "parent_id": "not-a-uuid" }
// Expected: 400 - "Invalid uuid"

// Empty content
{ "content": "" }
// Expected: 400 - "String must contain at least 1 character(s)"
```

---

### 2. Vendor Verification API
**Route**: `POST /api/vendor/verify`  
**Schema**: `VendorVerificationSchema`

```typescript
{
  businessName: string (min: 2, max: 200),
  businessType: string (min: 2, max: 100),
  taxId?: string | null,
  businessAddress?: {
    street?: string,
    city?: string,
    state?: string | null,
    zip?: string,
    country?: string (default: "US")
  },
  phoneNumber?: string (E.164 format, default: "+1234567890"),
  idDocumentUrl?: string | null (URL format),
  businessLicenseUrl?: string | null (URL format),
  additionalDocuments?: string[] | null (array of URLs),
  notes?: string | null (max: 1000)
}
```

**Valid Test Request**:
```json
{
  "businessName": "Acme Corp",
  "businessType": "Technology",
  "phoneNumber": "+14155551234",
  "businessAddress": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94105",
    "country": "US"
  }
}
```

**Invalid Test Cases**:
```json
// Missing required field
{ "businessType": "Tech" }
// Expected: 400 - "businessName is required"

// Business name too short
{ "businessName": "A", "businessType": "Tech" }
// Expected: 400 - "String must contain at least 2 character(s)"

// Invalid phone format
{ "businessName": "Acme", "businessType": "Tech", "phoneNumber": "555-1234" }
// Expected: 400 - "Invalid phone number format"

// Invalid URL
{ 
  "businessName": "Acme", 
  "businessType": "Tech",
  "idDocumentUrl": "not-a-url"
}
// Expected: 400 - "Invalid url"
```

---

### 3. Vendor Applications API
**Route**: `PATCH /api/vendor/applications/[id]`  
**Schema**: `VendorApplicationActionSchema`

```typescript
{
  action: "approve" | "deny",
  message?: string (max: 1000)
}
```

**Valid Test Request**:
```json
PATCH /api/vendor/applications/123e4567-e89b-12d3-a456-426614174000
{
  "action": "deny",
  "message": "Please provide more documentation"
}
```

**Invalid Test Cases**:
```json
// Invalid enum value
{ "action": "pending" }
// Expected: 400 - "Invalid enum value. Expected 'approve' | 'deny'"

// Message too long
{ "action": "deny", "message": "x".repeat(1001) }
// Expected: 400 - "String must contain at most 1000 character(s)"

// Missing required field
{ "message": "Denied" }
// Expected: 400 - "action is required"
```

---

### 4. Gamification API
**Route**: `POST /api/gamification/update`  
**Schema**: `GamificationUpdateSchema`

```typescript
{
  userId: string (UUID),
  action: "purchase" | "post_created" | "comment_created" | "like_given" | 
          "follow_user" | "listing_created" | "booking_created" | "review_created",
  metadata?: Record<string, unknown> | null
}
```

**Valid Test Request**:
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "action": "post_created",
  "metadata": { "post_id": "abc123" }
}
```

**Invalid Test Cases**:
```json
// Invalid UUID
{ "userId": "not-a-uuid", "action": "post_created" }
// Expected: 400 - "Invalid uuid"

// Invalid action
{ "userId": "123e4567-e89b-12d3-a456-426614174000", "action": "invalid_action" }
// Expected: 400 - "Invalid enum value"

// Missing required fields
{ "action": "post_created" }
// Expected: 400 - "userId is required"
```

---

### 5. Bookings Create API
**Route**: `POST /api/bookings/create`  
**Schema**: `BookingCreateSchema` (with legacy field support)

```typescript
{
  listing_id: string (UUID),
  start_time: string (ISO 8601 datetime),
  end_time: string (ISO 8601 datetime),
  notes?: string | null (max: 1000)
}
```

**Valid Test Request**:
```json
{
  "listing_id": "123e4567-e89b-12d3-a456-426614174000",
  "start_time": "2024-12-01T10:00:00Z",
  "end_time": "2024-12-01T11:00:00Z",
  "notes": "Prefer morning appointment"
}
```

**Invalid Test Cases**:
```json
// Invalid datetime format
{ 
  "listing_id": "123e4567-e89b-12d3-a456-426614174000",
  "start_time": "2024-12-01",
  "end_time": "2024-12-01T11:00:00Z"
}
// Expected: 400 - "Invalid datetime string"

// Missing required field
{ "start_time": "2024-12-01T10:00:00Z", "end_time": "2024-12-01T11:00:00Z" }
// Expected: 400 - "listing_id is required"

// Notes too long
{
  "listing_id": "123e4567-e89b-12d3-a456-426614174000",
  "start_time": "2024-12-01T10:00:00Z",
  "end_time": "2024-12-01T11:00:00Z",
  "notes": "x".repeat(1001)
}
// Expected: 400 - "String must contain at most 1000 character(s)"
```

---

### 6. Bookings Update API
**Route**: `PATCH /api/bookings/update`  
**Schema**: `BookingUpdateSchema` (with date validation)

```typescript
{
  status?: "pending" | "confirmed" | "canceled" | "completed",
  start_time?: string (ISO 8601 datetime),
  end_time?: string (ISO 8601 datetime),
  notes?: string | null (max: 1000)
}
```

**Valid Test Request**:
```json
{
  "status": "confirmed",
  "notes": "Confirmed for tomorrow"
}
```

**Invalid Test Cases**:
```json
// Invalid status enum
{ "status": "in_progress" }
// Expected: 400 - "Invalid enum value. Expected 'pending' | 'confirmed' | 'canceled' | 'completed'"

// Invalid datetime
{ "start_time": "tomorrow" }
// Expected: 400 - "Invalid datetime string"
```

---

### 7. Admin Badges API
**Route**: `POST /api/admin/users/[id]/badges`  
**Schema**: `BadgeAssignSchema`

```typescript
{
  badge_id: string (UUID)
}
```

**Valid Test Request**:
```json
POST /api/admin/users/123e4567-e89b-12d3-a456-426614174000/badges
{
  "badge_id": "456e7890-e12b-34c5-d678-901234567890"
}
```

**Invalid Test Cases**:
```json
// Invalid UUID
{ "badge_id": "not-a-uuid" }
// Expected: 400 - "Invalid uuid"

// Missing required field
{}
// Expected: 400 - "badge_id is required"
```

---

## How to Test

### Using cURL (PowerShell)

**Test Comments POST with invalid data**:
```powershell
# Missing content field
curl -X POST "http://localhost:3000/api/posts/123e4567-e89b-12d3-a456-426614174000/comments" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -d '{}'

# Expected Response:
# {"error":"Validation failed","details":[{"field":"content","message":"Required"}]}
```

**Test with content too long**:
```powershell
$longContent = "x" * 1001
curl -X POST "http://localhost:3000/api/posts/123e4567-e89b-12d3-a456-426614174000/comments" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -d "{`"content`":`"$longContent`"}"

# Expected Response:
# {"error":"Validation failed","details":[{"field":"content","message":"String must contain at most 1000 character(s)"}]}
```

**Test with invalid UUID**:
```powershell
curl -X POST "http://localhost:3000/api/posts/123e4567-e89b-12d3-a456-426614174000/comments" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -d '{"content":"Nice!","parent_id":"not-a-uuid"}'

# Expected Response:
# {"error":"Validation failed","details":[{"field":"parent_id","message":"Invalid uuid"}]}
```

### Using Postman

1. Create a new collection called "Validation Tests"
2. For each route above, create test requests with:
   - **Valid data** (should return 200/201)
   - **Missing required fields** (should return 400)
   - **Type mismatches** (should return 400)
   - **Max length violations** (should return 400)
   - **Invalid formats** (UUIDs, dates, emails) (should return 400)

3. Use Postman's **Test Scripts** to verify responses:
```javascript
pm.test("Returns 400 for invalid data", function () {
    pm.response.to.have.status(400);
});

pm.test("Response has error message", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('error');
});

pm.test("Response has validation details", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('details');
});
```

---

## Expected Validation Error Format

All validation errors follow this structure:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "fieldName",
      "message": "Error message from Zod"
    }
  ]
}
```

**Example**:
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "content",
      "message": "String must contain at least 1 character(s)"
    },
    {
      "field": "parent_id",
      "message": "Invalid uuid"
    }
  ]
}
```

---

## Validation Coverage Summary

| Route | Schema | Status | Required Fields | Max Length | Format Validation |
|-------|--------|--------|----------------|------------|-------------------|
| Comments POST | CommentCreateSchema | ✅ | content | content: 1000 | parent_id: UUID |
| Vendor Verify | VendorVerificationSchema | ✅ | businessName, businessType | multiple | phone, URLs |
| Vendor Applications | VendorApplicationActionSchema | ✅ | action | message: 1000 | action: enum |
| Gamification | GamificationUpdateSchema | ✅ | userId, action | - | userId: UUID, action: enum |
| Bookings Create | BookingCreateSchema | ✅ | listing_id, start_time, end_time | notes: 1000 | UUIDs, datetimes |
| Bookings Update | BookingUpdateSchema | ✅ | none (all optional) | notes: 1000 | status: enum, datetimes |
| Admin Badges | BadgeAssignSchema | ✅ | badge_id | - | badge_id: UUID |

---

## Next Steps

### 1. Manual Testing (Immediate)
- [ ] Test each route with invalid data using cURL or Postman
- [ ] Verify 400 status codes are returned
- [ ] Verify error messages are clear and helpful
- [ ] Document any unexpected behavior

### 2. Automated Testing (Priority 2)
- [ ] Create unit tests for each validation schema
- [ ] Create integration tests for API routes
- [ ] Add to CI/CD pipeline

### 3. Documentation
- [ ] Add validation rules to API documentation
- [ ] Include example error responses in API docs
- [ ] Update client-side forms to match validation rules

---

## Common Zod Validation Rules

**String Validation**:
```typescript
z.string()               // Must be string
z.string().min(1)        // Non-empty
z.string().max(1000)     // Max 1000 chars
z.string().email()       // Valid email
z.string().url()         // Valid URL
z.string().uuid()        // Valid UUID
z.string().datetime()    // ISO 8601 datetime
```

**Number Validation**:
```typescript
z.number()               // Must be number
z.number().int()         // Integer only
z.number().positive()    // Greater than 0
z.number().nonnegative() // >= 0
z.number().min(0).max(100) // Range
```

**Enum Validation**:
```typescript
z.enum(['value1', 'value2']) // Must be one of these
```

**Optional/Nullable**:
```typescript
z.string().optional()    // Can be undefined
z.string().nullable()    // Can be null
z.string().optional().nullable() // Can be undefined or null
```

---

## Troubleshooting

### Error: "Invalid request body"
**Cause**: Request body is not valid JSON  
**Solution**: Check Content-Type header is `application/json`

### Error: "Validation failed" with empty details
**Cause**: Schema validation passed but custom validation failed  
**Solution**: Check route-specific validation logic

### TypeScript errors on `.omit()` or `.extend()`
**Cause**: Zod schema transformation type inference  
**Solution**: Use `validateRequest()` helper which handles types automatically

---

## Implementation Status: COMPLETE ✅

All 7 routes with request bodies now have comprehensive Zod validation:
1. ✅ Comments API - CommentCreateSchema
2. ✅ Vendor Verification - VendorVerificationSchema  
3. ✅ Vendor Applications - VendorApplicationActionSchema
4. ✅ Gamification - GamificationUpdateSchema
5. ✅ Bookings Create - BookingCreateSchema
6. ✅ Bookings Update - BookingUpdateSchema
7. ✅ Admin Badges - BadgeAssignSchema

**Total Coverage**: 100% of routes with request bodies  
**Ready for**: Manual testing → Automated testing → Production deployment
