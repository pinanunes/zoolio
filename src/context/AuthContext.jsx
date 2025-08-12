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
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (authUser) => {
    try {
      console.log('Fetching profile for user:', authUser.id);
      
      // First, get the basic profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        // Return basic user data if profile fetch fails
        return {
          id: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Utilizador',
          role: authUser.user_metadata?.role || 'student',
          personalPoints: 0,
          feedbackQuotas: {
            bot_junior: { used: 0, remaining: 5, max: 5 },
            bot_senior: { used: 0, remaining: 5, max: 5 }
          },
          team: null
        };
      }

      console.log('Profile fetched successfully:', profile);

      // Get feedback quotas using the new system
      let feedbackQuotas = {
        bot_junior: { used: 0, remaining: 5, max: 5 },
        bot_senior: { used: 0, remaining: 5, max: 5 }
      };

      if (profile.role === 'student') {
        try {
          const { data: quotaData, error: quotaError } = await supabase
            .rpc('get_user_feedback_quotas', { p_user_id: profile.id });

          if (!quotaError && quotaData) {
            feedbackQuotas = quotaData;
          }
        } catch (quotaFetchError) {
          console.warn('Failed to fetch feedback quotas:', quotaFetchError);
        }
      } else {
        // Professors and admins have unlimited feedback
        feedbackQuotas = {
          bot_junior: { used: 0, remaining: 999, max: 999 },
          bot_senior: { used: 0, remaining: 999, max: 999 }
        };
      }

      // Create base user object with safe defaults
      const userProfile = {
        id: profile.id,
        email: profile.email,
        name: profile.full_name || authUser.email?.split('@')[0] || 'Utilizador',
        role: profile.role || 'student',
        studentNumber: profile.student_number,
        teamId: profile.team_id,
        isApproved: profile.is_approved,
        personalPoints: profile.personal_points || 0,
        feedbackQuotas: feedbackQuotas,
        team: null
      };

      // If user has a team, try to fetch team data separately
      if (profile.team_id) {
        try {
          console.log('Fetching team data for team_id:', profile.team_id);
          
          const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .select(`
              id,
              team_name,
              assigned_disease_id,
              supervisor_id,
              blue_team_review_target_id,
              points,
              diseases (
                id,
                name
              )
            `)
            .eq('id', profile.team_id)
            .single();

          if (!teamError && teamData) {
            console.log('Team data fetched successfully:', teamData);
            userProfile.team = {
              id: teamData.id,
              name: teamData.team_name,
              points: teamData.points || 0,
              assignedDiseaseId: teamData.assigned_disease_id,
              supervisorId: teamData.supervisor_id,
              blueTeamReviewTargetId: teamData.blue_team_review_target_id,
              disease: teamData.diseases ? {
                id: teamData.diseases.id,
                name: teamData.diseases.name
              } : null
            };
          } else {
            console.warn('Error fetching team data:', teamError);
          }
        } catch (teamFetchError) {
          console.warn('Failed to fetch team data:', teamFetchError);
        }
      }

      console.log('Final user profile:', userProfile);
      return userProfile;

    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      // Return safe fallback data
      return {
        id: authUser.id,
        email: authUser.email,
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Utilizador',
        role: authUser.user_metadata?.role || 'student',
        personalPoints: 0,
        feedbackQuotas: {
          bot_junior: { used: 0, remaining: 5, max: 5 },
          bot_senior: { used: 0, remaining: 5, max: 5 }
        },
        team: null
      };
    }
  };

  useEffect(() => {
    let isMounted = true;
    let authSubscription = null;

    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing authentication...');
        
        // Get initial session with timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session check timeout')), 10000)
        );
        
        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (error) {
          console.error('❌ Session check error:', error);
          if (isMounted) {
            setLoading(false);
          }
          return;
        }

        console.log('📋 Initial session check:', session ? 'Session found' : 'No session');

        if (session?.user && isMounted) {
          console.log('👤 Fetching user profile for:', session.user.email);
          const userProfile = await fetchUserProfile(session.user);
          if (isMounted) {
            setUser(userProfile);
          }
        } else if (isMounted) {
          setUser(null);
        }

        // Set up auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('🔔 Auth state change:', event, session ? 'Session exists' : 'No session');
            
            if (!isMounted) return;

            try {
              if (session?.user) {
                console.log('👤 Auth change - fetching profile for:', session.user.email);
                const userProfile = await fetchUserProfile(session.user);
                if (isMounted) {
                  setUser(userProfile);
                }
              } else {
                console.log('🚪 Auth change - user logged out');
                if (isMounted) {
                  setUser(null);
                }
              }
            } catch (error) {
              console.error('❌ Error in auth state change handler:', error);
              if (isMounted) {
                setUser(null);
              }
            }
            
            if (isMounted) {
              setLoading(false);
            }
          }
        );

        authSubscription = subscription;

      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up auth context');
      isMounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
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

      if (error) {
        throw new Error(error.message);
      }

      // If user was created successfully, create profile
      if (data.user) {
        const profileData = {
          id: data.user.id,
          full_name: name,
          email: email,
          role: role,
          is_approved: role === 'student' ? true : false, // Students auto-approved, professors need approval
          personal_points: 0,
          feedback_junior_quota: 5,
          feedback_senior_quota: 5,
          feedback_arena_quota: 5
        };

        // Add student-specific fields
        if (role === 'student') {
          profileData.student_number = studentNumber;
          profileData.team_id = teamId;
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .insert([profileData]);

        if (profileError) {
          console.error('Profile creation error:', profileError);
          // Don't throw error here as auth user was created successfully
        }
      }

      // Check if user needs to confirm email
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

  const logout = async () => {
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
      // Call the database function to check and update quota
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
        // Update the user's quota in the context
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
