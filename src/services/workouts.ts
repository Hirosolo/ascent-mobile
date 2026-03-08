import { format } from 'date-fns';
import { apiFetch } from '@/lib/api/client';
import { WorkoutSession } from '@/types/api';

export function getWorkouts(month = format(new Date(), 'yyyy-MM')): Promise<WorkoutSession[]> {
  return apiFetch(`/workouts?month=${month}`);
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

export function deleteWorkout(sessionId: number): Promise<{ success: boolean }> {
  return apiFetch(`/workouts/${sessionId}`, {
    method: 'DELETE',
  });
}
