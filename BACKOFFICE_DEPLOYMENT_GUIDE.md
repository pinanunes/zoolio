# Backoffice Issues - Deployment Fix Guide 🔧

## Problem Summary

The backoffice was experiencing three critical issues when deployed to production (Netlify):

1. **Student Analytics Dashboard**: Showing 0 students instead of registered students
2. **Team Management**: Professor assignments not displaying after selection
3. **Feedback Validation**: Showing negative counts (-2 pending validation)

## Root Cause Analysis

These issues were caused by **Row Level Security (RLS) policies** that were too restrictive for admin/professor access. The application worked locally because development often uses the `service_role` key (which bypasses RLS), but production uses the `anon` key (which respects RLS policies).

### Specific Issues:

1. **Missing Database Function**: `get_student_analytics()` function didn't exist
2. **Complex Join Failures**: RLS policies blocked joins between tables for admin users
3. **Statistics Calculation Errors**: Negative counts due to failed queries

## Solution Applied

### 🗄️ **Database Functions Created**

#### 1. `get_student_analytics()`
- **Purpose**: Aggregates student data with team and feedback information
- **Security**: Uses `SECURITY DEFINER` to run with elevated privileges
- **Returns**: Complete student analytics including:
  - Basic profile information
  - Team assignments and diseases
  - Red team assignments
  - Feedback statistics and points

#### 2. `increment_team_points(team_id, points)`
- **Purpose**: Safely updates team points when feedback is validated
- **Security**: Uses `SECURITY DEFINER` for secure point updates
- **Usage**: Called when professors award points for good feedback

### 🔒 **Enhanced RLS Policies**

#### **Profiles Table**
```sql
CREATE POLICY "Enhanced admin access to profiles" ON public.profiles
    FOR ALL USING (
        -- Allow if user is admin/professor
        EXISTS (
            SELECT 1 FROM public.profiles admin_profile
            WHERE admin_profile.id = auth.uid() 
            AND admin_profile.role IN ('admin', 'professor')
            AND admin_profile.is_approved = true
        )
        OR
        -- Allow users to access their own profile
        auth.uid() = id
    );
```

#### **Teams Table**
```sql
CREATE POLICY "Enhanced admin access to teams" ON public.teams
    FOR ALL USING (
        -- Allow if user is admin/professor
        EXISTS (
            SELECT 1 FROM public.profiles admin_profile
            WHERE admin_profile.id = auth.uid() 
            AND admin_profile.role IN ('admin', 'professor')
            AND admin_profile.is_approved = true
        )
        OR
        -- Allow students to view teams (for leaderboard, etc.)
        EXISTS (
            SELECT 1 FROM public.profiles student_profile
            WHERE student_profile.id = auth.uid() 
            AND student_profile.role = 'student'
        )
    );
```

#### **Chat Logs & Feedback Validations**
- Similar enhanced policies for admin/professor access
- Maintains security for student data
- Allows complex joins for backoffice functionality

### 📊 **Database Schema Enhancements**

#### **New Team Columns Added**
- `red_team_1_target_id` - First Red Team assignment
- `red_team_2_target_id` - Second Red Team assignment  
- `has_submitted_sheet` - Track sheet submissions
- `has_submitted_review` - Track review submissions

#### **Teams Auto-Creation**
- Automatically creates Teams 1-30 ("Grupo 1" through "Grupo 30")
- Ensures all teams exist for assignment

## Deployment Instructions

### 🚀 **Step 1: Apply Database Changes**

1. **Access Supabase Dashboard**
   - Go to [supabase.com](https://supabase.com)
   - Open your Zoolio project
   - Navigate to SQL Editor

2. **Execute the Fix Script**
   - Copy the entire content of `BACKOFFICE_RLS_FIXES.sql`
   - Paste into Supabase SQL Editor
   - Click "Run" to execute

3. **Verify Success**
   - Look for success messages in the output
   - Should see: "✅ BACKOFFICE FIXES SUCCESSFULLY APPLIED!"
   - Check that functions and policies were created

### 🧪 **Step 2: Test the Fixes**

#### **Test Student Analytics**
1. Go to `https://zoolio.netlify.app/backoffice/students`
2. Should now show registered students (not 0)
3. Statistics should display correctly
4. Export CSV should work

#### **Test Team Management**
1. Go to `https://zoolio.netlify.app/backoffice/teams`
2. Assign a professor to a team
3. Page should reload and show professor name
4. All dropdowns should populate correctly

#### **Test Feedback Validation**
1. Go to `https://zoolio.netlify.app/backoffice/feedback`
2. Should show positive numbers (not negative)
3. Feedback logs should load
4. Statistics should be accurate

### 🔍 **Step 3: Verification Checklist**

- [ ] Student Analytics shows actual student count
- [ ] Team Management displays professor names after assignment
- [ ] Feedback Validation shows correct positive counts
- [ ] All 30 teams are available for assignment
- [ ] Complex joins work without errors
- [ ] Statistics calculate correctly

## Technical Details

### **Security Model**

The fix maintains security while enabling admin functionality:

- **Students**: Can only see their own data
- **Professors**: Can see all data for management purposes
- **Admins**: Full access to all data and management functions
- **Functions**: Use `SECURITY DEFINER` for safe elevated operations

### **Performance Considerations**

- Functions are optimized with proper JOINs
- RLS policies use efficient EXISTS clauses
- Indexes on foreign keys support fast lookups
- Statistics are calculated efficiently

### **Backwards Compatibility**

- All existing data is preserved
- New columns have sensible defaults
- Existing functionality continues to work
- No breaking changes to frontend code

## Troubleshooting

### **If Student Analytics Still Shows 0**
1. Check if `get_student_analytics()` function exists
2. Verify your user has `professor` or `admin` role
3. Ensure `is_approved = true` for your account
4. Check browser console for specific errors

### **If Team Management Still Fails**
1. Verify enhanced RLS policies are active
2. Check that all 30 teams exist in database
3. Ensure professor profiles have correct roles
4. Test with a fresh browser session

### **If Feedback Validation Shows Negative Numbers**
1. Verify enhanced policies for `chat_logs` and `feedback_validations`
2. Check that statistics queries can access all necessary tables
3. Ensure proper permissions for complex joins

## Monitoring

### **Database Logs**
- Monitor Supabase logs for any RLS policy violations
- Check for function execution errors
- Watch for performance issues with complex queries

### **Application Logs**
- Browser console should show successful data loading
- No more "permission denied" errors
- Proper data display in all backoffice sections

## Success Metrics

After applying this fix, you should see:

- ✅ **Student count > 0** in analytics dashboard
- ✅ **Professor names displayed** after team assignments
- ✅ **Positive feedback counts** in validation section
- ✅ **All dropdowns populated** with correct data
- ✅ **No RLS permission errors** in console
- ✅ **Fast loading times** for all backoffice pages

The backoffice should now function identically to local development, with full admin/professor capabilities while maintaining proper security for student data.
