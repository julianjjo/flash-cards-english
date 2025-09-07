# Data Model: Visual User Management Interface

## Core Entities

### User Entity
**Purpose**: Represents system users with authentication and role information

**Attributes**:
- `id`: Integer (Primary Key, Auto-increment)
- `email`: String (Unique, Required) - User's email address for login
- `password`: String (Hashed, Required) - Encrypted password
- `role`: String (Required, Default: "user") - User role ("user" | "admin")
- `created_at`: Timestamp (Auto-generated) - Account creation date
- `updated_at`: Timestamp (Auto-updated) - Last profile modification
- `last_login`: Timestamp (Nullable) - Last successful login time

**Relationships**:
- One-to-Many with Cards (user_id foreign key)
- Implicit relationship with Authentication Sessions

**Validation Rules**:
- Email must be valid email format
- Password minimum 8 characters
- Role must be either "user" or "admin"
- Email must be unique across system

**State Transitions**:
- Active → Deleted (admin action)
- User → Admin (admin promotion)
- Admin → User (admin demotion)

### Authentication State Entity
**Purpose**: Manages client-side authentication status and session information

**Attributes**:
- `user`: User object or null - Current authenticated user
- `token`: String (JWT) - Authentication token
- `isAuthenticated`: Boolean - Authentication status
- `loading`: Boolean - Authentication check in progress
- `error`: String or null - Authentication error message

**State Transitions**:
- Unauthenticated → Loading (auth check)
- Loading → Authenticated (successful login/token validation)
- Loading → Unauthenticated (failed auth/logout)
- Authenticated → Unauthenticated (logout/token expiry)

### Form State Entity  
**Purpose**: Manages form validation and submission states for authentication forms

**Attributes**:
- `values`: Object - Form field values
- `errors`: Object - Field-specific error messages
- `touched`: Object - Fields that have been interacted with
- `isSubmitting`: Boolean - Form submission in progress
- `isValid`: Boolean - Overall form validity
- `submitError`: String or null - Server-side submission error

**Validation Rules**:
- Email field: Required, valid email format
- Password field: Required, minimum 8 characters
- Confirm Password: Must match password field
- Real-time validation on field blur
- Submit button disabled when form invalid or submitting

### Admin Action Entity
**Purpose**: Represents administrative operations performed on users

**Attributes**:
- `id`: Integer (Primary Key) - Action identifier
- `admin_id`: Integer (Foreign Key) - Admin who performed action
- `target_user_id`: Integer (Foreign Key) - User affected by action
- `action_type`: String - Type of action ("promote" | "demote" | "delete")
- `timestamp`: Timestamp - When action was performed
- `success`: Boolean - Whether action completed successfully
- `error_message`: String or null - Error if action failed

**Business Rules**:
- Admin cannot perform actions on themselves (delete, demote)
- Action history is maintained for audit purposes
- Failed actions are logged with error details

## Data Relationships

### User ↔ Cards Relationship
- **Type**: One-to-Many
- **Implementation**: `user_id` foreign key in cards table
- **Business Rule**: User can only access their own cards
- **Admin Override**: Admins can view all cards but not modify

### User ↔ Admin Actions Relationship  
- **Type**: Many-to-Many (through admin_actions table)
- **Implementation**: `admin_id` and `target_user_id` foreign keys
- **Business Rule**: Complete audit trail of administrative actions

## Frontend Data Flow

### Authentication Flow
```
1. User submits login form
2. Form State validates input
3. API call with credentials
4. Authentication State updates with user/token
5. Protected routes become accessible
```

### User Management Flow (Admin)
```
1. Admin accesses user list
2. User data fetched from API
3. Admin performs action (promote/delete)
4. Admin Action entity created
5. User entity updated
6. UI reflects changes with feedback
```

### Profile Management Flow
```
1. User views profile
2. User data loaded from Authentication State
3. User edits profile fields
4. Form State manages validation
5. API call updates user entity
6. Authentication State refreshes with updated user
```

## Data Validation Strategy

### Client-Side Validation
- **Purpose**: Immediate user feedback, improved UX
- **Implementation**: React Hook Form with Yup schemas
- **Scope**: Format validation, required fields, field relationships

### Server-Side Validation  
- **Purpose**: Security, data integrity
- **Implementation**: Express middleware with validation libraries
- **Scope**: Business rules, uniqueness constraints, authorization

### Validation Rules by Entity

**User Entity Validation**:
- Email: Required, valid format, unique (server-side)
- Password: Required, min 8 chars, complexity rules
- Role: Must be valid enum value ("user" | "admin")

**Form State Validation**:
- Real-time validation on field blur
- Submit validation before API calls
- Server error integration with form state

**Admin Action Validation**:
- Admin authorization check
- Target user exists
- Business rule validation (no self-actions)

## Error Handling Strategy

### Client-Side Errors
- Form validation errors displayed inline
- Authentication errors shown in auth forms
- Network errors handled by error boundary
- User-friendly error messages

### Server-Side Errors
- API errors mapped to user-friendly messages
- Validation errors returned with field mapping
- Authorization errors trigger logout flow
- System errors logged and reported generically

This data model provides the foundation for implementing secure, user-friendly authentication and user management interfaces while maintaining data integrity and proper separation of concerns.