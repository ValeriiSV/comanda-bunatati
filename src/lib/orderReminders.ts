import type { OrderSchedule } from '@/hooks/useOrderSchedule';

export const REMINDER_KEY = 'bunatati_order_reminder_v1';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function orderDeadline(schedule: OrderSchedule) {
  const date = schedule.dates[0];
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = (schedule.cutoffTime || '12:00').split(':').map(Number);
  if (!year || !month || !day || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function icsDate(date: Date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function downloadOrderReminder(schedule: OrderSchedule) {
  const deadline = orderDeadline(schedule);
  if (!deadline) return false;
  const end = new Date(deadline.getTime() + 15 * 60 * 1000);
  const description = schedule.message || 'Ultimul moment pentru a trimite comanda de bunatati.';
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bunatati impreuna cu Valera//RO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:bunatati-${deadline.getTime()}@comanda-bunatati.pages.dev`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(deadline)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${escapeIcs('Termen comandă — Bunătăți cu Valera')}`,
    `DESCRIPTION:${escapeIcs(description)}\\nhttps://comanda-bunatati.pages.dev`,
    'URL:https://comanda-bunatati.pages.dev',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Mai ai 24 de ore pentru comanda de bunatati.',
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Mai ai 2 ore pentru comanda de bunatati.',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `reminder-comanda-${schedule.dates[0]}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function reminderId(schedule: OrderSchedule) {
  const deadline = orderDeadline(schedule);
  return deadline ? String(deadline.getTime()) : '';
}
