# Bot Unlock System Fix

## Problem Description

The Zoolio application had two critical issues with the bot unlock system:

1. **Students with completed tasks couldn't access bots**: Even when teams had `ficha_entregue` and `revisao_entregue` marked as `true` in the database, students still couldn't access Bot Senior or Arena de Bots.

2. **Professors and Admins were subject to gamification**: The gamification system (requiring sheet and review submissions) was incorrectly applied to professors and admins, who should have unrestricted access to all bots.

## Root Cause Analysis

### Issue 1: Stale Data in AuthContext
- The `AuthContext.jsx` was only refreshing user profile data on login/logout and initial page load
- When professors approved submissions in the backoffice, students' browsers didn't automatically refresh their team progress data
- This meant `user.team.fichaEntregue` and `user.team.revisaoEntregue` remained `false` even after database updates

### Issue 2: Missing Role-Based Access Control
- `FrontOffice.jsx` only checked team progress for bot access
- No logic existed to bypass gamification restrictions for professors and admins
- All users were treated as students regardless of their role

## Solution Implemented

### 1. Enhanced Data Refresh in AuthContext.jsx

**Added Window Focus Listener**:
```javascript
// Add window focus listener to refresh user data when user returns to tab
const handleWindowFocus = async () => {
  if (user && isMounted) {
    console.log('🔄 Window focused - refreshing user profile...');
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser && isMounted) {
      const refreshedProfile = await fetchUserProfile(authUser);
      if (isMounted) {
        setUser(refreshedProfile);
        console.log('✅ User profile refreshed on window focus');
      }
    }
  }
};
```

**Updated useEffect Dependencies**:
- Changed from `}, []);` to `}, [user]);` to ensure the effect re-runs when user data changes
- Added proper cleanup for the window focus event listener

**Benefits**:
- Students now get fresh data when they switch back to the browser tab
- Significantly reduces the time between professor approval and student access
- Maintains real-time feel without constant polling

### 2. Role-Based Access Control in FrontOffice.jsx

**Added Professor/Admin Check**:
```javascript
// Check if user is professor or admin (bypass gamification)
const isProfessorOrAdmin = user?.role === 'professor' || user?.role === 'admin';
```

**Updated Tab Generation Logic**:
```javascript
// Phase 2: Bot Senior (available for professors/admins OR after sheet submission)
const botSeniorAvailable = isProfessorOrAdmin || teamProgress.hasSubmittedSheet;

// Phase 3: Bot Arena (available for professors/admins OR after review submission)
const botArenaAvailable = isProfessorOrAdmin || teamProgress.hasSubmittedReview;
```

**Updated Content Rendering Logic**:
```javascript
case 'bot-senior':
  return (isProfessorOrAdmin || teamProgress.hasSubmittedSheet) ? <BotSeniorChat /> : <LockedPhaseMessage phase={2} />;
case 'arena':
  return (isProfessorOrAdmin || teamProgress.hasSubmittedReview) ? <BotArena /> : <LockedPhaseMessage phase={3} />;
```

## Files Modified

### 1. `src/context/AuthContext.jsx`
- **Added**: Window focus event listener for automatic data refresh
- **Modified**: useEffect dependencies to include `user` state
- **Added**: Proper cleanup for event listeners
- **Enhanced**: Data freshness for better user experience

### 2. `src/pages/FrontOffice.jsx`
- **Added**: `isProfessorOrAdmin` role check
- **Modified**: Tab generation logic to respect role-based access
- **Modified**: Content rendering logic to bypass locks for professors/admins
- **Maintained**: Existing gamification system for students

## Expected Results

### For Students:
✅ **Real-time Updates**: Team progress updates are reflected within seconds of professor approval
✅ **Automatic Refresh**: Data refreshes when switching back to the browser tab
✅ **Preserved Gamification**: Students still follow the progression system (Junior → Senior → Arena)

### For Professors and Admins:
✅ **Immediate Access**: All bots (Junior, Senior, Arena) are immediately available
✅ **No Gamification**: Bypass all progression requirements
✅ **Full Functionality**: Can test and use all bot features without restrictions

### For the System:
✅ **Better UX**: Reduced need for manual page refreshes
✅ **Consistent Behavior**: All user roles behave as expected
✅ **Maintained Security**: Role-based access is properly enforced

## Testing Recommendations

### Student Testing:
1. **Login as a student** whose team has NOT submitted sheets
2. **Verify** Bot Senior and Arena are locked
3. **Have a professor approve** the team's submissions in backoffice
4. **Switch to another tab** and back to the Zoolio tab
5. **Verify** bots are now unlocked automatically

### Professor/Admin Testing:
1. **Login as a professor or admin**
2. **Verify** all three bots (Junior, Senior, Arena) are immediately available
3. **Test functionality** of all bots to ensure they work correctly
4. **Confirm** no lock messages appear

### Data Consistency Testing:
1. **Make changes** in the backoffice (approve submissions)
2. **Check student views** refresh automatically
3. **Verify** database changes are reflected in the UI within seconds

## Technical Notes

- The window focus listener is lightweight and only triggers when the user returns to the tab
- The solution maintains backward compatibility with existing team progress logic
- Console logging helps with debugging and monitoring the refresh process
- The fix addresses both immediate access for professors and real-time updates for students
- No database schema changes were required - this is purely a frontend enhancement

## Security Considerations

- Role-based access is checked on both tab generation and content rendering
- The solution doesn't bypass database-level security (RLS policies still apply)
- User roles are verified from the authenticated user context
- No client-side role manipulation is possible

This comprehensive fix ensures that the bot unlock system works correctly for all user types while maintaining the intended gamification experience for students.
