export interface MonthOption {
  value: string; // YYYY-MM
  label: string; // e.g. "July 2026"
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function toMonthValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(value: string): string {
  const [year, month] = value.split("-");
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
}

// Options from `past` months back through `future` months ahead, oldest first
export function getMonthOptions(past = 24, future = 2): MonthOption[] {
  const options: MonthOption[] = [];
  const now = new Date();
  for (let i = -past; i <= future; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = toMonthValue(d);
    options.push({ value, label: monthLabel(value) });
  }
  return options;
}

// Months from a given start (YYYY-MM or ISO date) through `future` months ahead
export function getMonthOptionsFrom(start: string, future = 1): MonthOption[] {
  const startDate = new Date(start.length === 7 ? `${start}-01` : start);
  const now = new Date();
  const options: MonthOption[] = [];
  const d = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + future, 1);
  while (d <= end) {
    const value = toMonthValue(d);
    options.push({ value, label: monthLabel(value) });
    d.setMonth(d.getMonth() + 1);
  }
  return options;
}
