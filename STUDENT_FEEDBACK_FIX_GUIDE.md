# Student Feedback 500 Error - Fix Guide 🔧

## Problem Summary

Students were unable to submit feedback and were getting **500 Internal Server Errors** when clicking the feedback buttons (👍 or 👎). The browser console showed multiple failed requests to Supabase with status 500.

## Root Cause Analysis

The issue was caused by **overly restrictive Row Level Security (RLS) policies** for student operations. When students tried to:

1. **Submit feedback** → INSERT/UPDATE operations on `chat_logs` table failed
2. **Load their profile** → SELECT operations on `profiles` table failed  
3. **View leaderboard** → SELECT operations on `teams` table failed

These operations were being blocked by RLS policies, causing the database to return 500 errors instead of allowing the legitimate student actions.

### Key Error Patterns:
- `Failed to load resource: the server responded with a status of 500 ()`
- Requests to `/profiles`, `/teams`, and `/chat_logs` all failing
- `Error saving feedback: Object` in console logs

## Solution Applied

### 🔒 **Fixed RLS Policies for Students**

#### **1. Chat Logs Policies**
```sql
-- Students can INSERT their own chat logs (for new conversations)
CREATE POLICY "Students can insert their own chat logs" ON public.chat_logs
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'student'
        ) 
        AND user_id = auth.uid()
    );

-- Students can UPDATE their own chat logs (for feedback submission)
CREATE POLICY "Students can update their own chat logs" ON public.chat_logs
    FOR UPDATE 
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
```

#### **2. Profiles Policies**
```sql
-- Students can view their own profile
CREATE POLICY "Students can view their own profile" ON public.profiles
    FOR SELECT 
    USING (id = auth.uid());

-- Students can update their own profile
CREATE POLICY "Students can update their own profile" ON public.profiles
    FOR UPDATE 
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
```

#### **3. Teams Policies (Leaderboard)**
```sql
-- Students can view all teams (needed for leaderboard)
CREATE POLICY "Students can view teams for leaderboard" ON public.teams
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid()
        )
    );
```

#### **4. Comparative Chat Logs (Bot Arena)**
```sql
-- Students can use Bot Arena functionality
CREATE POLICY "Students can insert their own comparative chat logs" ON public.comparative_chat_logs
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'student'
        ) 
        AND user_id = auth.uid()
    );
```

#### **5. Diseases Policies**
```sql
-- Students can view diseases list (needed for UI)
CREATE POLICY "Students can view diseases" ON public.diseases
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid()
        )
    );
```

## Deployment Instructions

### 🚀 **Step 1: Apply the Student RLS Fix**

1. **Access Supabase Dashboard**
   - Go to [supabase.com](https://supabase.com)
   - Open your Zoolio project
   - Navigate to SQL Editor

2. **Execute the Student Fix Script**
   - Copy the entire content of `STUDENT_RLS_FIXES.sql`
   - Paste into Supabase SQL Editor
   - Click "Run" to execute

3. **Verify Success**
   - Look for success message: "✅ STUDENT RLS POLICIES SUCCESSFULLY FIXED!"
   - Check that all policy counts are correct
   - Should see policies created for all 5 tables

### 🧪 **Step 2: Test Student Functionality**

#### **Test Feedback Submission**
1. **Login as a student** at `https://zoolio.netlify.app/login`
2. **Go to Zoolio Chat** tab
3. **Ask a question** to the bot
4. **Click 👍 or 👎** on the response
5. **Verify no 500 errors** in browser console
6. **Check feedback is saved** (should see success message)

#### **Test Leaderboard**
1. **Go to Progress & Leaderboard** tab
2. **Verify teams load** without errors
3. **Check your team's position** displays correctly
4. **No 500 errors** in console

#### **Test Bot Arena**
1. **Go to Bot Arena** tab
2. **Ask a question** to get 3 responses
3. **Click "Esta é a melhor resposta"** on one bot
4. **Verify choice is saved** without errors
5. **No 500 errors** in console

### 🔍 **Step 3: Verification Checklist**

- [ ] Students can submit positive feedback (👍)
- [ ] Students can submit negative feedback (👎)
- [ ] Leaderboard loads and displays teams
- [ ] Bot Arena allows voting for best response
- [ ] No 500 errors in browser console
- [ ] Profile information loads correctly
- [ ] All student operations work smoothly

## Technical Details

### **Security Model Maintained**

The fix maintains proper security boundaries:

- **Students**: Can only access/modify their own data
- **Professors/Admins**: Retain full access for management
- **Cross-user access**: Prevented (students can't see other students' data)
- **Data integrity**: Maintained through proper WITH CHECK clauses

### **Performance Considerations**

- Policies use efficient `auth.uid()` comparisons
- EXISTS clauses are optimized for fast lookups
- No complex joins in student policies (keeps them fast)
- Indexes on `user_id` and `id` columns support quick filtering

### **Backwards Compatibility**

- All existing data remains accessible
- No breaking changes to frontend code
- Admin/professor functionality unaffected
- Previous RLS policies properly replaced

## Troubleshooting

### **If Students Still Get 500 Errors**

1. **Check Policy Creation**
   ```sql
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public' 
   AND policyname LIKE 'Students can%';
   ```

2. **Verify Student Role**
   - Ensure student accounts have `role = 'student'` in profiles table
   - Check that `is_approved = true` for student accounts

3. **Test with Fresh Session**
   - Clear browser cache and cookies
   - Login again as student
   - Test feedback submission

### **If Leaderboard Still Doesn't Load**

1. **Check Teams Table**
   ```sql
   SELECT COUNT(*) FROM public.teams;
   ```
   Should return 30 teams

2. **Verify Teams Policy**
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'teams' 
   AND policyname = 'Students can view teams for leaderboard';
   ```

### **If Bot Arena Doesn't Work**

1. **Check Comparative Logs Table**
   ```sql
   SELECT COUNT(*) FROM public.comparative_chat_logs;
   ```

2. **Verify Comparative Policies**
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'comparative_chat_logs' 
   AND policyname LIKE 'Students can%';
   ```

## Monitoring

### **Success Indicators**

After applying this fix, you should see:

- ✅ **No 500 errors** in browser console
- ✅ **Feedback submissions work** for both 👍 and 👎
- ✅ **Leaderboard loads** with team rankings
- ✅ **Bot Arena voting** functions correctly
- ✅ **Fast response times** for all student operations
- ✅ **Clean console logs** without RLS permission errors

### **Database Logs to Monitor**

- No more "permission denied" errors in Supabase logs
- Successful INSERT/UPDATE operations on chat_logs
- Successful SELECT operations on profiles, teams, diseases
- No RLS policy violations for student operations

## Success Metrics

The student experience should now be:

1. **Seamless feedback submission** - No errors when clicking 👍/👎
2. **Fast leaderboard loading** - Teams and rankings display immediately  
3. **Working Bot Arena** - Can vote for best responses without issues
4. **Clean user interface** - No error messages or failed operations
5. **Responsive performance** - All operations complete quickly

Students can now fully participate in the Zoolio learning experience without technical barriers!
