import { format } from 'date-fns';
import { apiFetch } from '@/lib/api/client';
import { NutritionGoal } from '@/types/api';

export type WaterResponse = {
  total_ml: number;
  goal_ml: number;
};

export function getGoal(): Promise<NutritionGoal> {
  return apiFetch('/nutrition/goals');
}

export function getMeals(month = format(new Date(), 'yyyy-MM')): Promise<unknown[]> {
  return apiFetch(`/meals?month=${month}`);
}

export function addWater(amount_ml: number, log_date: string): Promise<{ success: boolean }> {
  return apiFetch('/nutrition/water', {
    method: 'POST',
    body: JSON.stringify({ amount_ml, log_date }),
  });
}

export function getWater(date = format(new Date(), 'yyyy-MM-dd')): Promise<WaterResponse> {
  return apiFetch(`/nutrition/water?date=${date}`);
}
