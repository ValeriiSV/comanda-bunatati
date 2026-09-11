import { useEffect } from 'react';
import { useOrderSchedule } from '@/hooks/useOrderSchedule';

function targetMillis(date?: string, time?: string) {
  if (!date) return 0;
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return 0;
  const [hour, minute] = (time || '23:59').split(':').map(Number);
  return new Date(year, month - 1, day, Number.isFinite(hour) ? hour : 23, Number.isFinite(minute) ? minute : 59, 0).getTime();
}

function countdownLabel(date?: string, time?: string) {
  const target = targetMillis(date, time);
  if (!target) return 'Termenul va fi anunțat';
  const diff = target - Date.now();
  if (diff <= 0) return 'Termen încheiat';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days} zile ${hours} ore`;
  if (hours > 0) return `${hours} ore ${minutes} min`;
  return `${Math.max(1, minutes)} min`;
}

function enhanceScheduleNotices(date: string | undefined, cutoffTime: string | undefined) {
  if (!date || !cutoffTime) return;

  document.querySelectorAll('p').forEach((label) => {
    const text = label.textContent?.trim();
    if (text !== 'Următoarea comandă' && text !== 'Comandă închisă') return;
    const container = label.parentElement;
    if (!container) return;

    const candidateRows = Array.from(container.querySelectorAll('div'));
    const dateRow = candidateRows.find((row) => Array.from(row.children).some((child) => child.tagName === 'SPAN'));
    if (dateRow) {
      const spans = Array.from(dateRow.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName === 'SPAN');
      const first = spans[0];
      if (first) {
        const current = first.dataset.deadlineBase || first.textContent || '';
        if (!first.dataset.deadlineBase) first.dataset.deadlineBase = current.replace(/ · ora \d{2}:\d{2}/, '');
        first.textContent = `${first.dataset.deadlineBase} · ora ${cutoffTime}`;
      }
    }

    const clockLine = Array.from(container.querySelectorAll('p')).find((node) => node !== label && node.querySelector('svg'));
    if (clockLine) {
      const svg = clockLine.querySelector('svg');
      const value = countdownLabel(date, cutoffTime);
      if (svg) {
        const clone = svg.cloneNode(true);
        clockLine.replaceChildren(clone, document.createTextNode(` ${value}`));
      } else {
        clockLine.textContent = value;
      }
      clockLine.setAttribute('title', `Ora limită: ${cutoffTime}`);
    }
  });
}

export default function OrderDeadlinePublicEnhancer() {
  const { schedule } = useOrderSchedule();

  useEffect(() => {
    if (!schedule.dates[0] || !schedule.cutoffTime) return;
    const apply = () => enhanceScheduleNotices(schedule.dates[0], schedule.cutoffTime);
    apply();
    const timer = window.setInterval(apply, 5000);
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, [schedule.dates, schedule.cutoffTime]);

  return null;
}
