import { apiFetch } from '@/lib/api/client';
import { Program } from '@/types/api';

export function getPrograms(): Promise<Program[]> {
  return apiFetch('/programs');
}

export function startProgram(planId: number): Promise<{ success: boolean }> {
  return apiFetch(`/programs/${planId}/start`, {
    method: 'POST',
  });
}
