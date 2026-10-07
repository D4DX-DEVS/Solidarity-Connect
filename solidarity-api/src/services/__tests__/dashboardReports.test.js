import { dueReportMonth, reportProgress } from '../dashboardReports.js';

describe('dueReportMonth', () => {
  test('last month until its deadline passes (IST)', () => {
    const now = new Date('2026-10-07T06:00:00Z'); // 7 Oct IST, deadline day 10
    const due = dueReportMonth(now, 10);
    expect(due).toMatchObject({ year: 2026, month: 9, closing: true });
    expect(due.deadline.toISOString()).toBe('2026-10-10T18:29:59.999Z');
  });

  test('this month once last month has closed', () => {
    const now = new Date('2026-10-11T06:00:00Z'); // 11 Oct IST
    const due = dueReportMonth(now, 10);
    expect(due).toMatchObject({ year: 2026, month: 10, closing: false });
    expect(due.deadline.toISOString()).toBe('2026-11-10T18:29:59.999Z');
  });

  test('January looks back to December of the previous year', () => {
    const now = new Date('2027-01-05T06:00:00Z');
    expect(dueReportMonth(now, 10)).toMatchObject({ year: 2026, month: 12 });
  });

  test('December report is due in January of the next year', () => {
    const due = dueReportMonth(new Date('2026-12-20T06:00:00Z'), 10);
    expect(due).toMatchObject({ year: 2026, month: 12, closing: false });
    expect(due.deadline.toISOString()).toBe('2027-01-10T18:29:59.999Z');
  });

  test('flips to this month exactly when the deadline passes', () => {
    expect(dueReportMonth(new Date('2026-10-10T18:29:59.999Z'), 10)).toMatchObject({ month: 9, closing: true });
    expect(dueReportMonth(new Date('2026-10-10T18:30:00.000Z'), 10)).toMatchObject({ month: 10, closing: false });
  });

  test('the month turns at IST midnight, not UTC', () => {
    // 1 Oct 00:00 IST = 30 Sep 18:30 UTC: September is over and closing.
    expect(dueReportMonth(new Date('2026-09-30T18:30:00Z'), 10)).toMatchObject({ year: 2026, month: 9, closing: true });
  });
});

describe('reportProgress', () => {
  const districts = [{ _id: 'd1' }, { _id: 'd2' }];
  const groups = [
    { _id: 'a1', district: 'd1' },
    { _id: 'a2', district: 'd1' },
    { _id: 'a3', district: 'd2' },
  ];
  const reports = [
    { level: 'district', district: 'd1' },
    { level: 'area', district: 'd1', area: 'a1' },
    { level: 'area', district: 'd2', area: 'a9' }, // an area outside the scope's groups
  ];
  const progress = reportProgress({ districts, groups, reports });

  test('totals for districts and areas in scope', () => {
    expect(progress.districts).toEqual({ submitted: 1, total: 2 });
    expect(progress.areas).toEqual({ submitted: 1, total: 3 });
  });

  test('per district: own report and its areas', () => {
    expect(progress.district('d1')).toEqual({ submitted: true, areasSubmitted: 1, areaTotal: 2 });
    expect(progress.district('d2')).toEqual({ submitted: false, areasSubmitted: 0, areaTotal: 1 });
  });

  test('per area', () => {
    expect(progress.area('a1')).toEqual({ submitted: true });
    expect(progress.area('a2')).toEqual({ submitted: false });
  });

  test('no districts outside the state view', () => {
    expect(reportProgress({ districts: null, groups, reports }).districts).toBeNull();
  });
});
