import { differenceInDays, parseISO } from 'date-fns';
import { ContractStatus } from './constants';
import { Contract } from '../lib/db';

/**
 * Calculates the number of days a contract has been active.
 * Applies custom pawnshop business rules:
 * - If paid on the same day as loan day, counts as 2 days.
 * - Otherwise, counts as (current_date - start_date) + 1 day.
 */
export const calculateDaysActive = (startDateIso: string, toDate: Date = new Date()): number => {
  const start = parseISO(startDateIso);
  
  // Normalize to exact start of day to avoid time-based difference bugs
  const d1 = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  const d2 = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  
  let days = differenceInDays(d1, d2);
  
  if (days === 0) {
    return 2;
  } else if (days > 0) {
    return days + 1;
  }
  return 0;
};

/**
 * Calculates the total expected profit for a given contract.
 * Note: Interest rate is assumed to be per 1,000,000 VND per day.
 */
export const calculateExpectedProfit = (amount: number, interestRate: number, daysActive: number): number => {
  if (!amount || !interestRate || daysActive <= 0) return 0;
  // Calculate daily interest safely to avoid floating point precision loss on huge amounts
  const dailyInterest = (amount * interestRate) / 1000000;
  return Math.round(dailyInterest * daysActive);
};

/**
 * Derives the real-time status of a contract based on its age.
 * Contracts older than 30 days are automatically flagged as OVERDUE.
 */
export const evaluateContractStatus = (
  contract: Contract, 
  currentDate: Date = new Date()
): ContractStatus | string => {
  if (contract.status !== ContractStatus.PENDING) return contract.status;
  
  // Use calculateDaysActive instead of raw differenceInDays to ensure business rule consistency
  const days = calculateDaysActive(contract.start_date, currentDate);
  
  if (days >= 31) return ContractStatus.OVERDUE;
  return ContractStatus.PENDING;
};
