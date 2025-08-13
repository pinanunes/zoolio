# Feedback Quota Consistency Fix

## Problem Description

The feedback quota display was inconsistent between different components in the application:

1. **BotJuniorChat.jsx** correctly displayed quotas using `user.feedbackQuotas.bot_junior.remaining/max`
2. **ProgressLeaderboard.jsx** incorrectly used `user.feedbackQuotas.junior`, `user.feedbackQuotas.senior`, and `user.feedbackQuotas.arena` (wrong property names)
3. **AuthContext.jsx** wasn't refreshing user profile data on page reload, causing stale quota information to be displayed

## Root Cause

1. **Property Name Mismatch**: The ProgressLeaderboard component was using outdated property names that didn't match the actual structure returned by the `get_user_feedback_quotas` RPC function.

2. **Stale Data on Page Reload**: The AuthContext was only fetching fresh user profile data when authentication state changed (login/logout), but not on page reload. This meant that quota updates weren't reflected when users refreshed the page.

## Solution Implemented

### 1. Fixed AuthContext.jsx

Added automatic profile refresh on page load to ensure the latest quota data is always fetched from the database:

```javascript
if (session?.user && isMounted) {
  console.log('👤 Fetching user profile for:', session.user.email);
  const userProfile = await fetchUserProfile(session.user);
  if (isMounted) {
    setUser(userProfile);
    // Force refresh user profile to ensure latest data from database
    console.log('🔄 Refreshing user profile to ensure latest data...');
    setTimeout(async () => {
      if (isMounted) {
        const refreshedProfile = await fetchUserProfile(session.user);
        if (isMounted) {
          setUser(refreshedProfile);
          console.log('✅ User profile refreshed with latest data');
        }
      }
    }, 100);
  }
}
```

### 2. Fixed ProgressLeaderboard.jsx

Updated all quota property references to use the correct structure:

**Before:**
```javascript
// Incorrect property names
user.feedbackQuotas.junior
user.feedbackQuotas.senior  
user.feedbackQuotas.arena
```

**After:**
```javascript
// Correct property names matching the database structure
user.feedbackQuotas.bot_junior.remaining/max
user.feedbackQuotas.bot_senior.remaining/max
user.feedbackQuotas.bot_arena?.remaining/max (with safe navigation)
```

### 3. Added Safe Navigation

For the Arena quota, added safe navigation operators (`?.`) since this property might not always be present in the user object:

```javascript
{user.feedbackQuotas.bot_arena?.remaining || 0}/{user.feedbackQuotas.bot_arena?.max || 5}
```

## Files Modified

1. **src/context/AuthContext.jsx**
   - Added automatic profile refresh on page load
   - Ensures latest quota data is always available

2. **src/components/ProgressLeaderboard.jsx**
   - Fixed property names for all three bot quotas
   - Added safe navigation for Arena quota
   - Maintained color coding logic for quota status

## Expected Results

After these fixes:

1. ✅ **Consistent Display**: All components now show the same quota values
2. ✅ **Real-time Updates**: Quota changes are immediately reflected across all components
3. ✅ **Page Reload Persistence**: Quota values remain accurate even after page refresh
4. ✅ **Error Prevention**: Safe navigation prevents crashes if Arena quota is undefined

## Testing Recommendations

1. **Give feedback** in BotJuniorChat and verify the quota decreases in both the chat header and ProgressLeaderboard
2. **Refresh the page** and confirm quota values remain consistent
3. **Check all three quota displays** (Junior, Senior, Arena) in the ProgressLeaderboard
4. **Verify color coding** changes from green to red when quotas are exhausted

## Technical Notes

- The fix uses a 100ms timeout for the profile refresh to avoid race conditions
- Safe navigation operators prevent errors if certain quota properties are undefined
- The solution maintains backward compatibility with existing quota structures
- Console logging helps with debugging and monitoring the refresh process
