import { format } from 'date-fns';
import { apiFetch } from '@/lib/api/client';
import { ExerciseLog, WorkoutSession } from '@/types/api';

export function getWorkouts(month = format(new Date(), 'yyyy-MM')): Promise<WorkoutSession[]> {
  return apiFetch(`/workouts?month=${month}`);
}

export function getWorkoutById(sessionId: number | string): Promise<WorkoutSession> {
  return apiFetch(`/workouts/${sessionId}`);
}

export function createWorkout(payload: {
  scheduled_date: string;
  type?: string;
  notes?: string;
}): Promise<WorkoutSession> {
  return apiFetch('/workouts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function completeWorkout(sessionId: number): Promise<{ success: boolean }> {
  return apiFetch(`/workouts/${sessionId}/complete`, {
    method: 'PATCH',
  });
}

export function updateWorkout(
  sessionId: number | string,
  payload: {
    status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'UNFINISHED' | 'MISSED';
    notes?: string;
    type?: string;
    scheduled_date?: string;
  },
): Promise<WorkoutSession> {
  return apiFetch(`/workouts/${sessionId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function addExercisesToWorkout(
  sessionId: number | string,
  exercises: Array<{ exercise_id: number; planned_sets: number; planned_reps: number }>,
): Promise<{ session_id: number; added_exercises: number }> {
  return apiFetch(`/workouts/${sessionId}/session-details`, {
    method: 'POST',
    body: JSON.stringify({ exercises }),
  });
}

export function removeExerciseFromWorkout(
  sessionId: number | string,
  sessionDetailId: number | string,
): Promise<{ message: string }> {
  return apiFetch(`/workouts/${sessionId}/session-details`, {
    method: 'DELETE',
    body: JSON.stringify({ session_detail_id: Number(sessionDetailId) }),
  });
}

export function createExerciseLog(payload: {
  session_detail_id: number;
  actual_reps?: number;
  reps?: number;
  weight_kg?: number;
  duration?: number;
  status?: boolean;
  notes?: string;
}): Promise<ExerciseLog> {
  return apiFetch(`/workouts/logs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateExerciseLog(payload: {
  log_id: number;
  actual_reps?: number;
  reps?: number;
  weight_kg?: number;
  duration?: number;
  status?: boolean;
  notes?: string;
}): Promise<ExerciseLog> {
  return apiFetch(`/workouts/logs`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteExerciseLog(setId: number | string): Promise<{ message: string }> {
  return apiFetch(`/workouts/logs`, {
    method: 'DELETE',
    body: JSON.stringify({ set_id: Number(setId) }),
  });
}

export function deleteWorkout(sessionId: number): Promise<{ success: boolean }> {
  return apiFetch(`/workouts/${sessionId}`, {
    method: 'DELETE',
  });
}
