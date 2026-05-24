export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function formatIST(date: Date | string | number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(new Date(date));
}

export function getTodayIST(): string {
  const now = new Date();
  const istDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  return istDate;
}

export function formatTime(timeStr?: string): string {
  if (!timeStr) return '---';
  return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function getWeekDay(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short' });
}

export function calculateBreakHours(breakIn?: string, breakOut?: string): number {
  if (breakIn && breakOut) {
    const start = new Date(breakIn).getTime();
    const end = new Date(breakOut).getTime();
    return Math.max(0, (end - start) / (1000 * 60 * 60));
  }
  return 0;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'Present': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Full Day': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Overtime': 'bg-purple-50 text-purple-600 border-purple-100',
    'Half Day': 'bg-amber-50 text-amber-600 border-amber-100',
    'Absent': 'bg-rose-50 text-rose-500 border-rose-100',
    'Leave': 'bg-blue-50 text-blue-600 border-blue-100',
    'Week Off': 'bg-slate-100 text-slate-500 border-slate-200',
    'Pending Leave': 'bg-amber-50 text-amber-600 border-amber-100',
    'Rejected': 'bg-rose-50 text-rose-500 border-rose-100'
  };
  return colors[status] || 'bg-slate-50 text-slate-400 border-slate-100';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'Present': 'PRESENT',
    'Full Day': 'FULL DAY',
    'Overtime': 'OVERTIME',
    'Half Day': 'HALF DAY',
    'Absent': 'ABSENT',
    'Leave': 'ON LEAVE',
    'Week Off': 'WEEK OFF',
    'Pending Leave': 'PENDING'
  };
  return labels[status] || status.toUpperCase();
}