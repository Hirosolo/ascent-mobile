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
  user_id?: number;
  scheduled_date: string;
  type?: string;
  notes?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'UNFINISHED' | 'MISSED';
  completed?: boolean;
  gr_score?: number;
  session_details?: SessionDetail[];
};

export type Exercise = {
  exercise_id: number;
  name: string;
  category?: string;
  type?: string;
  description?: string;
};

export type ExerciseLog = {
  set_id?: number;
  log_id?: number;
  session_detail_id?: number;
  reps?: number;
  actual_reps?: number;
  weight_kg?: number;
  duration?: number;
  status?: boolean | 'COMPLETED' | 'UNFINISHED';
  notes?: string | null;
};

export type SessionDetail = {
  session_detail_id: number;
  session_id?: number;
  exercise_id: number;
  planned_sets?: number;
  planned_reps?: number;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'UNFINISHED' | 'MISSED';
  exercises?: Exercise;
  exercise_logs?: ExerciseLog[];
};

export type MuscleSplitItem = {
  name: string;
  value: number;
};

export type SummaryData = {
  total_workouts: number;
  total_volume?: number;
  gr_score: number;
  gr_avg?: number;
  gr_score_change: number;
  longest_streak: number;
  muscle_split?: MuscleSplitItem[];
  calories_avg: number;
  protein_avg: number;
  carbs_avg?: number;
  fats_avg?: number;
  fiber_avg?: number;
  daily_data?: Array<{
    date: string;
    workouts: number;
    kcal?: number;
    protein?: number;
    carbs?: number;
    fats?: number;
    fiber?: number;
    sugar?: number;
    gr: number;
    water?: number;
  }>;
  exercise_data?: Array<{
    name: string;
    count: number;
    volume: number;
    history: Array<{ date: string; weight: number; reps: number }>;
  }>;
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

export type WorkoutDayPlanExercise = {
  plan_exercise_id: number;
  exercise_id: number;
  planned_sets: number;
  planned_reps: number;
  sort_order?: number;
  exercise?: {
    exercise_id: number;
    name: string;
    category?: string;
    type?: string;
  };
};

export type WorkoutDayPlan = {
  plan_id: number;
  user_id: number;
  name: string;
  type?: string | null;
  notes?: string | null;
  exercises: WorkoutDayPlanExercise[];
};
