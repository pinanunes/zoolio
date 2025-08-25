import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Manages the initial auth check

  // This is your stable, correct fetchUserProfile function.
  const fetchUserProfile = async (authUser) => {
    try {
      console.log('HYDRATION: Fetching full profile for user:', authUser.id);
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError) {
        console.error('HYDRATION ERROR: Error fetching profile:', profileError);
        // If profile fails, log out the user to prevent an inconsistent state
        await supabase.auth.signOut();
        return null;
      }

      console.log('HYDRATION: Profile fetched successfully:', profile);

      const MAX_QUOTA = 5;
      let feedbackQuotas = {
        bot_junior: { used: 0, remaining: MAX_QUOTA, max: MAX_QUOTA },
        bot_senior: { used: 0, remaining: MAX_QUOTA, max: MAX_QUOTA },
        bot_arena:  { used: 0, remaining: MAX_QUOTA, max: MAX_QUOTA }
      };

      if (profile.role === 'student') {
        try {
          const { data: quotaData, error: quotaError } = await supabase
            .rpc('get_user_feedback_quotas', { p_user_id: profile.id });

          if (quotaError) {
             console.warn('HYDRATION: Failed to fetch feedback quotas, using defaults:', quotaError);
          } else if (quotaData) {
            quotaData.forEach(q => {
              if (feedbackQuotas[q.bot_id]) {
                const used = q.used_count || 0;
                feedbackQuotas[q.bot_id] = {
                  used: used,
                  remaining: Math.max(0, MAX_QUOTA - used),
                  max: MAX_QUOTA
                };
              }
            });
          }
        } catch (quotaFetchError) {
          console.warn('HYDRATION: Error fetching feedback quotas:', quotaFetchError);
        }
      } else {
        feedbackQuotas = {
          bot_junior: { used: 0, remaining: 999, max: 999 },
          bot_senior: { used: 0, remaining: 999, max: 999 },
          bot_arena:  { used: 0, remaining: 999, max: 999 }
        };
      }
      
      const userProfile = {
        // Start with the basic authUser data
        ...authUser,
        // Overwrite/add the detailed profile data
        name: profile.full_name,
        role: profile.role,
        studentNumber: profile.student_number,
        teamId: profile.team_id,
        isApproved: profile.is_approved,
        personalPoints: profile.personal_points || 0,
        feedbackQuotas: feedbackQuotas,
        team: null
      };

      if (profile.team_id) {
        try {
          const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .select(`*, diseases (id, name)`)
            .eq('id', profile.team_id)
            .single();

          if (!teamError && teamData) {
            userProfile.team = {
              id: teamData.id,
              name: teamData.team_name,
              points: teamData.points || 0,
              assignedDiseaseId: teamData.assigned_disease_id,
              supervisorId: teamData.supervisor_id,
              blueTeamReviewTargetId: teamData.blue_team_review_target_id,
              redTeam1TargetId: teamData.red_team_1_target_id,
              redTeam2TargetId: teamData.red_team_2_target_id,
              has_submitted_sheet: teamData.has_submitted_sheet || false,
              has_submitted_review: teamData.has_submitted_review || false,
              disease: teamData.diseases ? { id: teamData.diseases.id, name: teamData.diseases.name } : null
            };
          }
        } catch (teamFetchError) {
          console.warn('HYDRATION: Failed to fetch team data:', teamFetchError);
        }
      }
      console.log('HYDRATION: Final user profile constructed:', userProfile);
      return userProfile;

    } catch (error) {
      console.error('HYDRATION: Critical error in fetchUserProfile:', error);
      return null;
    }
  };

  // --- START: NEW STAGED HYDRATION LOGIC ---

  // Effect 1: Handles only the initial, fast authentication check.
  useEffect(() => {
    let isMounted = true;
    console.log("Auth Stage 1: Setting up auth listener.");

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        console.log(`Auth Stage 1: onAuthStateChange event: ${event}`);
        // Set the basic user object immediately. Hydration will happen in the next effect.
        setUser(session?.user ?? null);
        // This is the key: we stop loading as soon as we know if there's a session or not.
        setLoading(false);
      }
    );

    return () => {
      console.log("Auth Stage 1: Cleaning up listener.");
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Effect 2: Handles the "hydration" of the user profile after authentication is confirmed.
  useEffect(() => {
    let isMounted = true;
    // This effect runs only when the `user` object changes.
    if (user && !user.name) { // Check if the user object is "raw" (not hydrated)
      console.log("Auth Stage 2: Raw user detected. Starting profile hydration...");
      fetchUserProfile(user).then(fullProfile => {
        if (isMounted) {
          console.log("Auth Stage 2: Hydration complete. Setting full profile.");
          setUser(fullProfile);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [user]); // Dependency array ensures this runs when the user state changes

  // --- END: NEW STAGED HYDRATION LOGIC ---

  const login = async (email, password) => {
    // This will trigger onAuthStateChange, which handles the rest.
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { success: true, user: data.user };
  };

  const register = async (name, email, password, role, studentNumber = null, teamId = null) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            role: role,
          }
        }
      });

      if (error) throw new Error(error.message);

      if (data.user) {
        const profileData = {
          id: data.user.id,
          full_name: name,
          email: email,
          role: role,
          is_approved: role === 'student' ? true : false,
          personal_points: 0
        };

        if (role === 'student') {
          profileData.student_number = studentNumber;
          profileData.team_id = teamId;
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .insert([profileData]);

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }
      }

      if (data.user && !data.session) {
        const message = role === 'professor' 
          ? 'Por favor, verifique o seu email para confirmar a conta. O seu registo aguarda aprovação de um gestor.'
          : 'Por favor, verifique o seu email para confirmar a conta.';
        
        return { 
          success: true, 
          user: data.user,
          needsConfirmation: true,
          message: message
        };
      }

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  /* const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new Error(error.message);
      }
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }; */
  const logout = async () => {
    // This will trigger onAuthStateChange, which handles the rest.
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };
  const refreshUserProfile = async () => {
    if (user) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const userProfile = await fetchUserProfile(authUser);
        setUser(userProfile);
      }
    }
  };

  const updateFeedbackQuota = async (botId) => {
    if (!user || user.role !== 'student') return;

    try {
      const { data: quotaResult, error } = await supabase
        .rpc('check_and_update_feedback_quota', {
          p_user_id: user.id,
          p_bot_id: botId
        });

      if (error) {
        console.error('Error updating feedback quota:', error);
        return { success: false, message: 'Erro ao atualizar quota de feedback' };
      }

      if (quotaResult.success) {
        setUser(prevUser => {
          const updatedQuotas = { ...prevUser.feedbackQuotas };
          if (updatedQuotas[botId]) {
            updatedQuotas[botId] = {
              used: quotaResult.current_count,
              remaining: quotaResult.remaining,
              max: quotaResult.max_quota
            };
          }
          
          return {
            ...prevUser,
            feedbackQuotas: updatedQuotas
          };
        });
      }

      return quotaResult;
    } catch (error) {
      console.error('Error in updateFeedbackQuota:', error);
      return { success: false, message: 'Erro ao atualizar quota de feedback' };
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshUserProfile,
    updateFeedbackQuota,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};