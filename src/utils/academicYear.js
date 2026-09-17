import { supabase } from '../supabaseClient';

export const getCurrentAcademicYearId = async () => {
  const { data, error } = await supabase.rpc('current_academic_year_id');
  if (error) throw error;
  return data;
};
