import { format } from 'date-fns';
import { apiFetch } from '@/lib/api/client';
import { SummaryData } from '@/types/api';

export function getSummary(month = format(new Date(), 'yyyy-MM')): Promise<SummaryData> {
  return apiFetch(`/summary?month=${month}`);
}
