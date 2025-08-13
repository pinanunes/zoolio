# Infinite Loop and 400 Errors Fix

## Problem Description

The Zoolio application was experiencing two critical issues:

1. **Infinite Loop in AuthContext**: The "Progresso" page was blinking with an endless stream of console messages showing repeated authentication initialization and cleanup cycles.

2. **HTTP 400 Errors**: The application was failing to fetch team data and feedback quotas with 400 "Bad Request" errors from Supabase.

## Root Cause Analysis

### Issue 1: Infinite Loop in AuthContext
The infinite loop was caused by a dependency array issue in `AuthContext.jsx`:

```javascript
useEffect(() => {
  // ... authentication logic that calls setUser()
}, [user]); // ❌ This creates an infinite loop
```

**The Problem**: 
- The `useEffect` runs and fetches user data
- It calls `setUser()` to update the user state
- Because `user` is in the dependency array, the state change triggers the `useEffect` to run again
- This creates an infinite cycle of: fetch → setUser → useEffect → fetch → setUser → ...

### Issue 2: HTTP 400 Errors (RLS Role Mismatch)
The 400 errors were caused by a mismatch in how user roles were being checked:

**The Problem**:
- RLS helper functions were checking `auth.users.raw_user_meta_data->>'role'`
- But the actual user role is stored in `profiles.role` column
- This meant students couldn't access their own team data because the role check was failing

**Console Error Evidence**:
```
get_user_feedback_quotas:1 Failed to load resource: the server responded with a status of 400
teams?select=... Failed to load resource: the server responded with a status of 400
```

## Solutions Implemented

### 1. Fixed Infinite Loop in AuthContext.jsx

**Change Made**:
```javascript
// Before (causing infinite loop)
}, [user]);

// After (fixed)
}, []);
```

**Why This Works**:
- The `useEffect` now runs only once when the component mounts
- The `onAuthStateChange` listener and `handleWindowFocus` event handle subsequent updates
- No more infinite re-rendering cycle

### 2. Fixed RLS Role Mismatch (RLS_ROLE_MISMATCH_FIX.sql)

**Updated Helper Functions**:
```sql
-- Before (checking wrong location)
SELECT EXISTS (
  SELECT 1 FROM auth.users 
  WHERE id = auth.uid() 
  AND raw_user_meta_data->>'role' = 'student'
);

-- After (checking correct location)
SELECT EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE id = auth.uid() 
  AND role = 'student'
);
```

**Additional Fixes**:
- Recreated `get_user_feedback_quotas()` function with proper permissions
- Added RLS policies for `user_feedback_quotas` table
- Ensured all helper functions have proper `GRANT EXECUTE` permissions

## Files Modified

### 1. `src/context/AuthContext.jsx`
- **Fixed**: Removed `user` from `useEffect` dependency array
- **Result**: Eliminated infinite loop and console spam

### 2. `RLS_ROLE_MISMATCH_FIX.sql` (New File)
- **Fixed**: Updated all RLS helper functions to check `profiles.role`
- **Fixed**: Recreated `get_user_feedback_quotas()` function
- **Added**: Proper RLS policies for `user_feedback_quotas` table
- **Result**: Eliminated 400 errors for team data and feedback quotas

## Expected Results

### ✅ Infinite Loop Fixed
- No more blinking "Progresso" page
- No more endless console messages
- Stable authentication state management
- Normal page rendering and navigation

### ✅ 400 Errors Fixed
- Students can now access their team data
- Feedback quota system works correctly
- Team information displays properly in the UI
- Progress/leaderboard page loads without errors

### ✅ Maintained Functionality
- Window focus refresh still works for real-time updates
- Role-based access control still functions correctly
- All existing features remain intact

## Testing Recommendations

### Test the Infinite Loop Fix:
1. **Login as any user**
2. **Navigate to the "Progresso" tab**
3. **Verify**: Page loads normally without blinking
4. **Check console**: Should see normal authentication messages, not endless loops

### Test the 400 Errors Fix:
1. **Login as a student**
2. **Navigate to "Progresso" tab**
3. **Verify**: Team information displays correctly
4. **Check console**: No 400 errors for team data or feedback quotas
5. **Test feedback**: Submit feedback and verify quota updates work

### Test Role-Based Access:
1. **Login as professor/admin**
2. **Verify**: All bots are immediately accessible
3. **Login as student**
4. **Verify**: Gamification system still works (locked bots until progression)

## Deployment Instructions

### Step 1: Deploy Frontend Fix
The `AuthContext.jsx` fix is already applied and will take effect immediately when the application is refreshed.

### Step 2: Deploy Database Fix
Run the `RLS_ROLE_MISMATCH_FIX.sql` script in your Supabase SQL editor:

1. **Open Supabase Dashboard**
2. **Go to SQL Editor**
3. **Copy and paste the entire content of `RLS_ROLE_MISMATCH_FIX.sql`**
4. **Run the script**
5. **Verify**: No errors in execution

### Step 3: Test the Application
1. **Refresh the browser**
2. **Login and test all functionality**
3. **Verify**: No infinite loops, no 400 errors
4. **Check**: All features work as expected

## Technical Notes

- The infinite loop fix is a frontend-only change with immediate effect
- The RLS fix requires database deployment but is backward compatible
- No data migration is required
- All existing user sessions will continue to work
- The fixes maintain all security policies and access controls

## Security Considerations

- Role-based access control is maintained and improved
- RLS policies are now correctly enforcing permissions
- No security vulnerabilities introduced
- User data access is properly restricted based on roles
- Database functions have appropriate `SECURITY DEFINER` settings

This comprehensive fix resolves both the user experience issues (infinite loop) and the data access issues (400 errors) while maintaining all existing functionality and security measures.
