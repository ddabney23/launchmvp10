# 🛡️ Optimix Admin Guide

Administrator documentation for managing the Optimix platform.

---

## Table of Contents

1. [Accessing Admin Dashboard](#accessing-admin-dashboard)
2. [User Management](#user-management)
3. [Vendor Management](#vendor-management)
4. [Content Moderation](#content-moderation)
5. [Order Management](#order-management)
6. [Gamification Management](#gamification-management)
7. [Analytics & Reports](#analytics--reports)
8. [System Maintenance](#system-maintenance)
9. [Security & Compliance](#security--compliance)

---

## Accessing Admin Dashboard

### Admin Access

Only users with admin privileges can access the admin dashboard.

**URL**: `/admin`

### Becoming an Admin

Admins are designated by:
1. **Email whitelist**: Emails listed in `src/lib/admin.ts`
2. **Database flag**: `is_admin` field in profiles table

To add an admin:

```sql
-- Via Supabase SQL Editor
UPDATE profiles
SET is_admin = true
WHERE email = 'admin@example.com';
```

Or add to whitelist in `src/lib/admin.ts`:

```typescript
const ADMIN_EMAILS = [
  'admin@example.com',
  'support@example.com',
];
```

---

## User Management

### Viewing Users

Access: **Admin Dashboard** → **Users**

View all registered users with:
- Username and email
- Registration date
- Account status
- Vendor status
- Last activity

### User Actions

#### View User Profile
1. Click on a user
2. View full profile details
3. See user activity history

#### Ban/Suspend User
1. Select user
2. Click **Actions** → **Suspend Account**
3. Choose duration or permanent
4. Add reason (required)
5. Confirm

⚠️ Suspended users cannot log in.

#### Delete User Account
1. Select user
2. Click **Actions** → **Delete Account**
3. Review warning about data deletion
4. Confirm with admin password
5. User data is permanently removed

**Deleted data includes**:
- Profile information
- Posts and comments
- Listings (if vendor)
- Messages
- Order history (marked as deleted)

#### Reset User Password
1. Select user
2. Click **Actions** → **Reset Password**
3. Temporary password is generated
4. Email sent to user with reset link

### Bulk Actions

Select multiple users to:
- Send announcement email
- Export user data
- Apply tags/labels

---

## Vendor Management

### Pending Applications

Access: **Admin Dashboard** → **Vendors** → **Pending**

Review vendor applications:

#### Approve Vendor
1. Review application details:
   - Business name
   - Business type
   - Verification documents
2. Check business legitimacy
3. Click **Approve**
4. User receives notification

#### Reject Vendor Application
1. Review application
2. Click **Reject**
3. Provide rejection reason
4. User receives notification with reason

### Active Vendors

View all active vendors:
- Vendor name
- Total sales
- Order count
- Rating
- Status (active/suspended)

### Vendor Actions

#### Suspend Vendor
1. Select vendor
2. Click **Suspend**
3. Choose reason:
   - Policy violation
   - Customer complaints
   - Fraudulent activity
   - Other (specify)
4. Vendor's listings are hidden
5. Vendor receives notification

#### Revoke Vendor Status
Permanently removes vendor privileges:
1. Select vendor
2. Click **Revoke Vendor Status**
3. Confirm action
4. All listings are deactivated
5. Vendor returns to customer status

#### View Vendor Analytics
- Total revenue
- Order fulfillment rate
- Customer satisfaction
- Response time
- Return/refund rate

---

## Content Moderation

### Reported Content

Access: **Admin Dashboard** → **Moderation** → **Reports**

Review user-reported content:
- Posts
- Comments
- Listings
- Messages
- User profiles

### Moderation Actions

#### Review Report
1. View reported content
2. See report reason
3. Check reporter's history
4. Review content guidelines

#### Take Action

**Approve (No Violation)**:
- Mark as reviewed
- No action taken
- Report dismissed

**Remove Content**:
- Delete post/comment/listing
- Notify content creator
- Add strike to user account

**Warn User**:
- Send warning message
- Content may be edited/removed
- User must acknowledge warning

**Ban Content Creator**:
- Remove violating content
- Suspend user account
- See [Ban/Suspend User](#user-actions)

### Automated Moderation

Configure automated filters:
1. Go to **Settings** → **Moderation**
2. Set up keyword filters
3. Enable AI content analysis
4. Configure auto-actions:
   - Auto-flag for review
   - Auto-hide pending review
   - Auto-remove (severe violations)

---

## Order Management

### Viewing Orders

Access: **Admin Dashboard** → **Orders**

View all platform orders:
- Order ID
- Customer
- Vendor
- Amount
- Status
- Date

### Order Statuses

- `pending` - Order placed, awaiting payment
- `paid` - Payment received
- `processing` - Being prepared
- `shipped` - In transit
- `delivered` - Completed
- `canceled` - Canceled by customer/admin
- `refunded` - Payment refunded
- `disputed` - Under dispute

### Admin Order Actions

#### Cancel Order
1. Select order
2. Click **Cancel Order**
3. Choose reason
4. Process refund if paid
5. Notify customer and vendor

#### Issue Refund
1. Select order (must be paid)
2. Click **Issue Refund**
3. Choose refund amount:
   - Full refund
   - Partial refund (specify amount)
4. Add refund reason
5. Confirm

Refund processed through Stripe within 5-10 business days.

#### Resolve Dispute
1. View dispute details
2. Review evidence from both parties
3. Make decision:
   - Favor customer (refund)
   - Favor vendor (no refund)
   - Partial resolution
4. Add resolution notes
5. Confirm decision

Both parties are notified.

---

## Gamification Management

### Managing Badges

Access: **Admin Dashboard** → **Gamification** → **Badges**

#### Create Badge
1. Click **Create Badge**
2. Fill in details:
   - Badge name
   - Description
   - Icon (emoji or image)
   - Requirements
3. Set rarity (common, rare, epic, legendary)
4. Click **Create**

#### Edit/Delete Badge
1. Select badge
2. Click **Edit** or **Delete**
3. Make changes
4. Save

⚠️ Deleting a badge removes it from all users.

#### Award Badge Manually
1. Go to user profile
2. Click **Award Badge**
3. Select badge
4. Add note (optional)
5. User receives notification

### Points Management

#### Adjust User Points
1. Go to user profile
2. Click **Adjust Points**
3. Choose:
   - Add points
   - Remove points
4. Enter amount
5. Add reason (required)
6. Confirm

#### Configure Point Values
1. Go to **Settings** → **Gamification**
2. Edit point values for actions:
   - Create post: X points
   - Complete purchase: X points
   - Leave review: X points
3. Save changes

### Credits System

#### Grant Credits
1. Go to user profile
2. Click **Grant Credits**
3. Enter amount
4. Add reason (e.g., "Compensation", "Promotion")
5. User receives notification

#### Promotional Campaigns
Create credit promotions:
1. Go to **Marketing** → **Promotions**
2. Click **New Promotion**
3. Set:
   - Credit amount
   - Eligibility criteria
   - Start/end dates
4. Launch campaign

---

## Analytics & Reports

### Dashboard Overview

Access: **Admin Dashboard** → **Analytics**

Key metrics:
- Total users (growth rate)
- Active users (daily/monthly)
- Total revenue
- Order count
- Conversion rates
- Top vendors
- Top products

### Reports

#### User Analytics
- User growth over time
- User demographics
- Retention rates
- Churn analysis
- Engagement metrics

#### Sales Analytics
- Revenue trends
- Sales by category
- Top selling products
- Vendor performance
- Payment success rates

#### Content Analytics
- Posts created
- Engagement rates (likes, comments)
- Popular content
- Active communities

### Export Reports

1. Select report type
2. Choose date range
3. Select export format:
   - CSV
   - Excel
   - PDF
4. Click **Export**

Reports are generated and emailed to admin.

---

## System Maintenance

### Database Management

#### Run Migrations

```bash
# Production environment
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

#### Database Backups

Automated daily backups via Supabase.

**Manual backup**:
1. Go to Supabase Dashboard
2. Database → Backups
3. Click **Create Backup**

#### Restore from Backup

⚠️ **Critical**: This will overwrite current data!

1. Go to Supabase Dashboard
2. Database → Backups
3. Select backup
4. Click **Restore**
5. Confirm action

### Performance Monitoring

#### Health Check

Monitor system health: `/api/health`

**Healthy response**:
```json
{
  "status": "healthy",
  "checks": {
    "supabase": "healthy",
    "environment": "healthy",
    "stripe": "healthy"
  }
}
```

#### Error Tracking

Access: Sentry Dashboard (`sentry.io`)

Monitor:
- Error rates
- Error types
- Affected users
- Performance issues

#### Logs

View logs in:
- **Vercel Dashboard** → Logs
- **Supabase Dashboard** → Logs
- **Sentry** → Issues

### Scheduled Tasks

Configure cron jobs:

```javascript
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/daily-digest",
      "schedule": "0 8 * * *"
    }
  ]
}
```

---

## Security & Compliance

### Security Monitoring

#### Failed Login Attempts

Monitor suspicious activity:
1. Go to **Security** → **Login Attempts**
2. View failed logins
3. Check for:
   - Multiple failures from same IP
   - Brute force patterns
   - Account takeover attempts

#### Block IP Addresses

1. Go to **Security** → **IP Blocks**
2. Click **Add IP Block**
3. Enter IP address or range
4. Add reason
5. Set duration or permanent
6. Confirm

### Data Privacy (GDPR)

#### Data Export Requests

Users can request their data:

1. Request appears in **Admin** → **Data Requests**
2. Review request
3. Click **Generate Export**
4. System creates ZIP file with user's data
5. Email download link to user

Must be completed within 30 days.

#### Data Deletion Requests

1. Request appears in **Admin** → **Data Requests**
2. Review request
3. Verify user identity
4. Click **Process Deletion**
5. Confirm deletion
6. User data permanently removed

Must be completed within 30 days.

### Audit Logs

All admin actions are logged:

1. Go to **Admin** → **Audit Logs**
2. View:
   - Action type
   - Admin user
   - Timestamp
   - Details
   - IP address

Logs retained for 1 year.

### Security Best Practices

✅ **DO**:
- Use strong, unique passwords
- Enable 2FA on admin account
- Review audit logs regularly
- Keep software updated
- Limit admin access
- Use least privilege principle
- Monitor error rates
- Review user reports promptly

❌ **DON'T**:
- Share admin credentials
- Use admin account for testing
- Ignore security alerts
- Skip backup verification
- Grant admin access casually

---

## Emergency Procedures

### Site Outage

1. Check `/api/health` endpoint
2. Review error logs in Sentry
3. Check Vercel/hosting status
4. Verify database connectivity
5. Notify users via status page
6. Escalate to development team if needed

### Data Breach

1. **Immediately**: Isolate affected systems
2. **Document**: What data was accessed
3. **Notify**: Development team and management
4. **Investigate**: How breach occurred
5. **Remediate**: Fix vulnerability
6. **Notify Users**: If required by law
7. **Report**: To authorities if required

### Payment Issues

1. Check Stripe Dashboard for incidents
2. Verify webhook configuration
3. Review failed payment logs
4. Contact Stripe support if needed
5. Notify affected users
6. Process manual refunds if required

---

## Support & Escalation

### Contact Development Team

- **Email**: dev@optimix.com
- **Slack**: #admin-support
- **Emergency**: +1-XXX-XXX-XXXX

### Escalation Path

1. **Tier 1**: Admin handles routine issues
2. **Tier 2**: Senior admin for complex issues
3. **Tier 3**: Development team for technical issues
4. **Emergency**: On-call engineer for critical issues

---

## Admin Training Resources

- **Admin Portal**: https://admin.optimix.com
- **Training Videos**: https://training.optimix.com
- **API Docs**: See `API_DOCUMENTATION.md`
- **Developer Docs**: See `README.md`

---

**Admin Version**: 1.0.0  
**Last Updated**: January 2024  
**Support**: admin-support@optimix.com

