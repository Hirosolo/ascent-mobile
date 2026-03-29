export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
  errors?: Array<{ message?: string }>;
};

export type User = {
  user_id: number;
  id?: number;
  username?: string;
  fullname?: string;
  email: string;
  phone?: string;
};

export type LoginResponse = {
  token: string;
  user: User;
};

export type WorkoutSession = {
  session_id: number;
  scheduled_date: string;
  type?: string;
  notes?: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  gr_score?: number;
};

export type SummaryData = {
  total_workouts: number;
  gr_score: number;
  gr_score_change: number;
  longest_streak: number;
  calories_avg: number;
  protein_avg: number;
  carbs_avg: number;
  fats_avg: number;
};

export type NutritionGoal = {
  calories_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  hydration_target_ml: number;
};

export type Program = {
  plan_id: number;
  name: string;
  description?: string;
};
