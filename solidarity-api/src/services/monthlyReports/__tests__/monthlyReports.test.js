import { normaliseFormFields, sumColumns } from '../fields.js';
import { validateAnswers, isFieldVisible, changedFieldIds, canUpgradeForm, repeatedFieldIds } from '../answers.js';
import { deadlineFor, editState, lockTimeFor, parsePeriod, parseYear, monthsElapsed } from '../period.js';
import { consolidate, consolidateYear, unitsOf } from '../consolidate.js';
import { DEFAULT_FORMS } from '../defaultForms.js';

const num = (id, extra = {}) => ({ id, type: 'number', label: `N${id}`, required: true, sum: true, ...extra });

describe('normaliseFormFields', () => {
  test('cleans a valid form and advances nextFieldId', () => {
    const { fields, nextFieldId, error } = normaliseFormFields(
      [
        { id: 1, type: 'number', label: '  Meetings ', required: true, min: 0, junk: 'x' },
        { id: 2, type: 'select', label: 'Venue', options: ['Hall', ' Mosque ', 'Hall', ''] },
        { id: 3, type: 'number', label: 'Attendees', condition: { fieldId: 1, operator: 'greater_than', value: '0' } },
      ],
      { savedIds: [], nextFieldId: 1 },
    );
    expect(error).toBeUndefined();
    expect(nextFieldId).toBe(4);
    expect(fields[0]).toMatchObject({ id: 1, type: 'number', label: 'Meetings', required: true, min: 0, sum: true });
    expect(fields[0].junk).toBeUndefined();
    expect(fields[1].options).toEqual(['Hall', 'Mosque']);
    expect(fields[2].condition).toEqual({ fieldId: 1, operator: 'greater_than', value: '0' });
  });

  test('never reuses a deleted field id', () => {
    const { error } = normaliseFormFields([num(2)], { savedIds: [1], nextFieldId: 3 });
    expect(error).toMatch(/id/i);
  });

  test('keeps saved ids and accepts new ids from the counter', () => {
    const { error, nextFieldId } = normaliseFormFields([num(1), num(7)], { savedIds: [1], nextFieldId: 7 });
    expect(error).toBeUndefined();
    expect(nextFieldId).toBe(8);
  });

  test('rejects duplicate ids, empty labels, unknown types and option-less choices', () => {
    expect(normaliseFormFields([num(1), num(1)], { savedIds: [], nextFieldId: 1 }).error).toMatch(/duplicate/i);
    expect(normaliseFormFields([num(1, { label: '  ' })], { savedIds: [], nextFieldId: 1 }).error).toMatch(/label/i);
    expect(normaliseFormFields([{ id: 1, type: 'slider', label: 'x' }], { savedIds: [], nextFieldId: 1 }).error).toMatch(/type/i);
    expect(normaliseFormFields([{ id: 1, type: 'radio', label: 'x', options: [] }], { savedIds: [], nextFieldId: 1 }).error).toMatch(/option/i);
  });

  test('a condition may only point at an earlier answerable field', () => {
    const later = normaliseFormFields(
      [num(1, { condition: { fieldId: 2, operator: 'equals', value: '1' } }), num(2)],
      { savedIds: [], nextFieldId: 1 },
    );
    expect(later.error).toMatch(/earlier/i);
    const heading = normaliseFormFields(
      [{ id: 1, type: 'heading', label: 'Area' }, num(2, { condition: { fieldId: 1, operator: 'is_empty' } })],
      { savedIds: [], nextFieldId: 1 },
    );
    expect(heading.error).toMatch(/earlier/i);
  });

  test('rejects min greater than max', () => {
    expect(normaliseFormFields([num(1, { min: 5, max: 2 })], { savedIds: [], nextFieldId: 1 }).error).toMatch(/min/i);
  });
});

describe('validateAnswers', () => {
  const fields = [
    { id: 1, type: 'heading', label: 'Area' },
    num(2),
    num(3, { condition: { fieldId: 2, operator: 'greater_than', value: '0' } }),
    { id: 4, type: 'text', label: 'Notes', required: false, maxLength: 10 },
    { id: 5, type: 'checkbox', label: 'Topics', required: false, options: ['A', 'B'] },
    { id: 6, type: 'yesno', label: 'Held?', required: false },
    { id: 7, type: 'number', label: 'Amount', required: false, sum: false, allowDecimal: true },
  ];

  test('accepts valid answers and lists add-up numbers', () => {
    const { answers, numbers, errors } = validateAnswers(fields, {
      f2: '2', f3: 40, f4: ' hi ', f5: ['B', 'B'], f6: 'yes', f7: 12.5, f99: 'unknown',
    });
    expect(errors).toEqual([]);
    expect(answers).toEqual({ f2: 2, f3: 40, f4: 'hi', f5: ['B'], f6: 'yes', f7: 12.5 });
    expect(numbers).toEqual([{ fieldId: 2, value: 2 }, { fieldId: 3, value: 40 }]);
  });

  test('drops answers for hidden fields and does not require them', () => {
    const { answers, errors } = validateAnswers(fields, { f2: 0, f3: 99 });
    expect(errors).toEqual([]);
    expect(answers).toEqual({ f2: 0 });
  });

  test('reports required, range, integer, length and option errors', () => {
    const { errors } = validateAnswers(fields, { f2: 1.5, f4: 'way too long text', f5: ['C'], f6: 'maybe' });
    const ids = errors.map(e => e.fieldId).sort();
    expect(ids).toEqual([2, 4, 5, 6]);
    expect(validateAnswers([num(1, { min: 0 })], { f1: -1 }).errors[0].fieldId).toBe(1);
    expect(validateAnswers([num(1)], {}).errors[0].message).toMatch(/required/i);
  });

  test('checks email, phone, date, time and file shapes', () => {
    const shaped = [
      { id: 1, type: 'email', label: 'E' },
      { id: 2, type: 'phone', label: 'P' },
      { id: 3, type: 'date', label: 'D' },
      { id: 4, type: 'time', label: 'T' },
      { id: 5, type: 'file', label: 'F' },
    ];
    const bad = validateAnswers(shaped, { f1: 'nope', f2: 'abc', f3: '2026-13-40', f4: '25:00', f5: { url: 'javascript:x' } });
    expect(bad.errors.map(e => e.fieldId)).toEqual([1, 2, 3, 4, 5]);
    const good = validateAnswers(shaped, {
      f1: 'a@b.co', f2: '+91 98765 43210', f3: '2026-10-06', f4: '18:30',
      f5: { url: 'https://cdn.example.com/x.jpg', name: 'x.jpg', size: 10, extra: 1 },
    });
    expect(good.errors).toEqual([]);
    expect(good.answers.f5).toEqual({ url: 'https://cdn.example.com/x.jpg', name: 'x.jpg', size: 10 });
  });

  test('file urls must pass the host allowlist when given', () => {
    const r = validateAnswers([{ id: 1, type: 'file', label: 'F' }], { f1: { url: 'https://evil.test/x' } }, {
      isAllowedFileUrl: (url) => url.startsWith('https://cdn.example.com/'),
    });
    expect(r.errors[0].fieldId).toBe(1);
  });
});

describe('isFieldVisible / changedFieldIds', () => {
  test('operators', () => {
    const f = (operator, value) => ({ id: 2, type: 'text', label: 'x', condition: { fieldId: 1, operator, value } });
    expect(isFieldVisible(f('equals', 'yes'), { f1: 'yes' })).toBe(true);
    expect(isFieldVisible(f('equals', 'A'), { f1: ['A', 'B'] })).toBe(true);
    expect(isFieldVisible(f('not_equals', 'yes'), { f1: 'no' })).toBe(true);
    expect(isFieldVisible(f('less_than', '5'), { f1: 3 })).toBe(true);
    expect(isFieldVisible(f('greater_than', '5'), {})).toBe(false);
    expect(isFieldVisible(f('is_empty'), { f1: [] })).toBe(true);
    expect(isFieldVisible(f('is_not_empty'), { f1: 'x' })).toBe(true);
    expect(isFieldVisible({ id: 3, type: 'text', label: 'y' }, {})).toBe(true);
  });

  test('lists field ids whose answers changed', () => {
    expect(changedFieldIds({ f1: 1, f2: ['a'], f3: 'x' }, { f1: 1, f2: ['a', 'b'], f4: 'y' })).toEqual([2, 3, 4]);
  });
});

describe('period', () => {
  test('parsePeriod validates year and month', () => {
    expect(parsePeriod({ year: '2026', month: '9' })).toEqual({ year: 2026, month: 9 });
    expect(parsePeriod({ year: '2026', month: '13' }).error).toBeDefined();
    expect(parsePeriod({ year: { $gt: 1 }, month: '1' }).error).toBeDefined();
  });

  test('due date (dashboard reminder) is 23:59:59 IST on the deadline day of the next month', () => {
    expect(deadlineFor(2026, 9, 10).toISOString()).toBe('2026-10-10T18:29:59.999Z');
    expect(deadlineFor(2026, 12, 10).toISOString()).toBe('2027-01-10T18:29:59.999Z');
  });

  test('a month locks at the end of the second month after it, 23:59:59 IST', () => {
    expect(lockTimeFor(2026, 8).toISOString()).toBe('2026-10-31T18:29:59.999Z');
    expect(lockTimeFor(2026, 10).toISOString()).toBe('2026-12-31T18:29:59.999Z');
    expect(lockTimeFor(2026, 11).toISOString()).toBe('2027-01-31T18:29:59.999Z');
  });

  test('editState: in October, August to October are open; July is locked', () => {
    const now = new Date('2026-10-16T06:00:00Z'); // 16 Oct IST
    expect(editState({ year: 2026, month: 10, now })).toMatchObject({ locked: false, future: false });
    expect(editState({ year: 2026, month: 9, now })).toMatchObject({ locked: false });
    expect(editState({ year: 2026, month: 8, now })).toMatchObject({ locked: false });
    expect(editState({ year: 2026, month: 7, now })).toMatchObject({ locked: true, future: false });
    expect(editState({ year: 2026, month: 11, now })).toMatchObject({ locked: true, future: true });
  });

  test('editState: the window ends with the IST month, and an unlock reopens a locked month', () => {
    const lastMoment = new Date('2026-10-31T18:29:00Z'); // 31 Oct 23:59 IST
    const nextMorning = new Date('2026-10-31T18:31:00Z'); // 1 Nov 00:01 IST
    expect(editState({ year: 2026, month: 8, now: lastMoment }).locked).toBe(false);
    expect(editState({ year: 2026, month: 8, now: nextMorning }).locked).toBe(true);
    expect(editState({ year: 2025, month: 12, now: new Date('2027-01-05T06:00:00Z') }).locked).toBe(true);
    expect(editState({ year: 2026, month: 11, now: new Date('2027-01-05T06:00:00Z') }).locked).toBe(false);
    expect(editState({ year: 2026, month: 7, now: new Date('2026-10-16T06:00:00Z'), unlockedUntil: new Date('2026-10-20T00:00:00Z') }))
      .toMatchObject({ locked: false });
  });
});

describe('consolidate', () => {
  const districts = [{ _id: 'd1', name: 'Kozhikode' }, { _id: 'd2', name: 'Malappuram' }];
  const areas = [
    { _id: 'a1', name: 'Medical College', district: 'd1' },
    { _id: 'a2', name: 'Feroke', district: 'd1' },
    { _id: 'a3', name: 'Tirur', district: 'd2' },
  ];
  const sub = new Date('2026-10-02T00:00:00Z');
  const reports = [
    { _id: 'r1', level: 'district', district: 'd1', submittedAt: sub, numbers: [{ fieldId: 1, value: 1 }, { fieldId: 2, value: 5 }] },
    { _id: 'r2', level: 'area', district: 'd1', area: 'a1', submittedAt: sub, numbers: [{ fieldId: 3, value: 2 }, { fieldId: 4, value: 40 }] },
    { _id: 'r3', level: 'area', district: 'd1', area: 'a2', submittedAt: sub, numbers: [{ fieldId: 3, value: 1 }] },
    { _id: 'r4', level: 'area', district: 'd2', area: 'a3', submittedAt: null, numbers: [] }, // unlock stub
    { _id: 'r5', level: 'state', submittedAt: sub, numbers: [{ fieldId: 9, value: 3 }] },
  ];
  const result = consolidate({ districts, areas, reports, includeState: true });

  test('adds area numbers up per district and statewide', () => {
    const koz = result.districts.find(d => d.id === 'd1');
    expect(koz.areaTotals).toEqual({ 3: 3, 4: 40 });
    expect(koz.areasSubmitted).toBe(2);
    expect(koz.report).toMatchObject({ submitted: true, reportId: 'r1', numbers: { 1: 1, 2: 5 } });
    expect(result.totals.area).toEqual({ 3: 3, 4: 40 });
    expect(result.totals.district).toEqual({ 1: 1, 2: 5 });
    expect(result.totals.state).toEqual({ 9: 3 });
  });

  test('unsubmitted stubs count as missing', () => {
    const mal = result.districts.find(d => d.id === 'd2');
    expect(mal.areas[0].report).toMatchObject({ submitted: false, reportId: 'r4' });
    expect(mal.report.submitted).toBe(false);
    expect(result.counts).toEqual({ districts: { submitted: 1, total: 2 }, areas: { submitted: 2, total: 3 } });
  });

  test('state report hidden unless included', () => {
    expect(consolidate({ districts, areas, reports, includeState: false }).state).toBeNull();
  });
});

describe('year period', () => {
  test('parseYear validates the year only', () => {
    expect(parseYear({ year: '2026' })).toEqual({ year: 2026 });
    expect(parseYear({ year: '1999' }).error).toBeDefined();
    expect(parseYear({ year: { $gt: 1 } }).error).toBeDefined();
  });

  test('monthsElapsed: 12 for past years, months so far this year, 0 ahead', () => {
    const now = new Date('2026-10-06T06:00:00Z'); // October IST
    expect(monthsElapsed(2025, now)).toBe(12);
    expect(monthsElapsed(2026, now)).toBe(10);
    expect(monthsElapsed(2027, now)).toBe(0);
  });
});

describe('consolidateYear', () => {
  const districts = [{ _id: 'd1', name: 'Kozhikode' }, { _id: 'd2', name: 'Malappuram' }];
  const areas = [
    { _id: 'a1', name: 'Medical College', district: 'd1' },
    { _id: 'a2', name: 'Feroke', district: 'd1' },
    { _id: 'a3', name: 'Tirur', district: 'd2' },
  ];
  const sub = new Date('2026-03-02T00:00:00Z');
  const n = (pairs) => pairs.map(([fieldId, value]) => ({ fieldId, value }));
  const reports = [
    { _id: 'd1m1', level: 'district', district: 'd1', month: 1, submittedAt: sub, numbers: n([[1, 1]]) },
    { _id: 'd1m2', level: 'district', district: 'd1', month: 2, submittedAt: sub, numbers: n([[1, 2], [2, 5]]) },
    { _id: 'a1m1', level: 'area', district: 'd1', area: 'a1', month: 1, submittedAt: sub, numbers: n([[3, 2]]) },
    { _id: 'a1m2', level: 'area', district: 'd1', area: 'a1', month: 2, submittedAt: sub, numbers: n([[3, 4]]) },
    { _id: 'a1m3', level: 'area', district: 'd1', area: 'a1', month: 3, submittedAt: null, numbers: [] }, // unlock stub
    { _id: 'a2m2', level: 'area', district: 'd1', area: 'a2', month: 2, submittedAt: sub, numbers: n([[3, 1]]) },
    { _id: 'a3m1', level: 'area', district: 'd2', area: 'a3', month: 1, submittedAt: null, numbers: [] },
    { _id: 's1', level: 'state', month: 1, submittedAt: sub, numbers: n([[9, 3]]) },
    { _id: 's2', level: 'state', month: 2, submittedAt: sub, numbers: n([[9, 1]]) },
  ];
  const result = consolidateYear({ districts, areas, reports, includeState: true, months: 3 });
  const koz = result.districts.find(d => d.id === 'd1');
  const mal = result.districts.find(d => d.id === 'd2');

  test('adds every submitted month per scope, with no single report to open', () => {
    expect(koz.report).toMatchObject({ submitted: true, reportId: null, monthsSubmitted: 2, numbers: { 1: 3, 2: 5 } });
    expect(koz.areas.find(a => a.id === 'a1').report).toMatchObject({ monthsSubmitted: 2, numbers: { 3: 6 } });
    expect(koz.areas.find(a => a.id === 'a2').report).toMatchObject({ monthsSubmitted: 1, numbers: { 3: 1 } });
    expect(koz.areaTotals).toEqual({ 3: 7 });
    expect(koz.areaMonthsSubmitted).toBe(3);
    expect(result.totals).toEqual({ area: { 3: 7 }, district: { 1: 3, 2: 5 }, state: { 9: 4 } });
  });

  test('scopes with only unsubmitted months count as missing', () => {
    expect(mal.report).toMatchObject({ submitted: false, monthsSubmitted: 0 });
    expect(mal.areas[0].report).toMatchObject({ submitted: false, monthsSubmitted: 0, numbers: {} });
    expect(mal.areaMonthsSubmitted).toBe(0);
  });

  test('counts scopes reporting and months submitted against months so far', () => {
    expect(result.counts.districts).toEqual({ submitted: 1, total: 2 });
    expect(result.counts.areas).toEqual({ submitted: 2, total: 3 });
    expect(result.counts.months).toEqual({
      district: { submitted: 2, total: 6 },
      area: { submitted: 3, total: 9 },
      state: { submitted: 2, total: 3 },
    });
    expect(result.state).toMatchObject({ monthsSubmitted: 2, numbers: { 9: 4 } });
  });

  test('no state months without the state in scope', () => {
    const scoped = consolidateYear({ districts, areas, reports, includeState: false, months: 3 });
    expect(scoped.state).toBeNull();
    expect(scoped.counts.months.state).toBeNull();
  });
});

describe('consolidated units', () => {
  const districts = [{ _id: 'd1', name: 'Kozhikode' }];
  const areas = [{ _id: 'a1', name: 'Medical College', district: 'd1' }, { _id: 'a2', name: 'Feroke', district: 'd1' }];
  const sub = new Date('2026-10-02T00:00:00Z');
  const n = (pairs) => pairs.map(([fieldId, value]) => ({ fieldId, value }));
  const october = {
    _id: 'r1', level: 'area', district: 'd1', area: 'a1', month: 10, submittedAt: sub, numbers: n([[2, 5], [3, 2]]),
    answers: {
      f2: 5, f3: 2, f5: 2,
      g1: [{ name: 'Kovoor', f2: 3, f3: 1, f4: 'notes' }, { name: 'Palazhi', f2: 2, f3: 1 }],
    },
  };

  test('unitsOf: each named entry with its numbers, text answers left out', () => {
    expect(unitsOf(october.answers)).toEqual([
      { name: 'Kovoor', numbers: { 2: 3, 3: 1 } },
      { name: 'Palazhi', numbers: { 2: 2, 3: 1 } },
    ]);
    expect(unitsOf({ f2: 1 })).toEqual([]);
    expect(unitsOf(undefined)).toEqual([]);
  });

  test('a unit named in two sections is one row', () => {
    expect(unitsOf({ g1: [{ name: 'Kovoor', f2: 3 }], g6: [{ name: 'kovoor ', f7: 4 }] })).toEqual([
      { name: 'Kovoor', numbers: { 2: 3, 7: 4 } },
    ]);
  });

  test('month: area rows carry their units; unsubmitted and district rows do not', () => {
    const stub = { _id: 'r2', level: 'area', district: 'd1', area: 'a2', submittedAt: null, numbers: [], answers: { g1: [{ name: 'X', f2: 9 }] } };
    const district = { _id: 'r3', level: 'district', district: 'd1', submittedAt: sub, numbers: n([[1, 1]]), answers: {} };
    const [koz] = consolidate({ districts, areas, reports: [october, stub, district], includeState: false }).districts;
    expect(koz.areas.find(a => a.id === 'a1').report.units.map(u => u.name)).toEqual(['Kovoor', 'Palazhi']);
    expect(koz.areas.find(a => a.id === 'a2').report.units).toEqual([]);
    expect(koz.report.units).toBeUndefined();
  });

  test('year: the same unit across months is added up by name', () => {
    const november = {
      ...october, _id: 'r4', month: 11,
      answers: { g1: [{ name: 'kovoor', f2: 1 }, { name: 'Chevayur', f2: 4, f3: 2 }] },
    };
    const [koz] = consolidateYear({ districts, areas, reports: [october, november], includeState: false, months: 11 }).districts;
    expect(koz.areas.find(a => a.id === 'a1').report.units).toEqual([
      { name: 'Kovoor', numbers: { 2: 4, 3: 1 } },
      { name: 'Palazhi', numbers: { 2: 2, 3: 1 } },
      { name: 'Chevayur', numbers: { 2: 4, 3: 2 } },
    ]);
  });
});

describe('DEFAULT_FORMS', () => {
  test('each seeded form is valid', () => {
    for (const level of ['state', 'district', 'area']) {
      const form = DEFAULT_FORMS[level];
      const { error } = normaliseFormFields(form.fields, { savedIds: [], nextFieldId: 1 });
      expect(error).toBeUndefined();
    }
  });

  test('area form asks how many attended the members meet, only when one was held', () => {
    const area = DEFAULT_FORMS.area.fields;
    const attendees = area.find(f => f.condition);
    const meet = area.find(f => f.id === attendees.condition.fieldId);
    expect(meet.label).toBe('മെമ്പേഴ്‌സ് മീറ്റ്');
    expect(attendees.condition).toMatchObject({ operator: 'greater_than', value: '0' });
  });
});

describe('sumColumns', () => {
  test('tags each add-up number with the heading above it', () => {
    const columns = sumColumns(DEFAULT_FORMS.area.fields);
    const youth = columns.filter(c => c.label === 'യൂത്ത് മീറ്റ്');
    expect(youth.map(c => c.section)).toEqual(['യൂണിറ്റ്', 'ഏരിയ']);
    expect(columns.every(c => c.section)).toBe(true);
    expect(columns.find(c => c.id === 5).parentId).toBe(4);
    expect(columns.find(c => c.id === 4).parentId).toBeNull();
  });

  test('skips non-summed fields and leaves section null before any heading', () => {
    const columns = sumColumns([num(1), num(2, { sum: false }), { id: 3, type: 'text', label: 'Note' }]);
    expect(columns).toEqual([{ id: 1, label: 'N1', section: null, parentId: null }]);
  });
});

describe('per-unit sections (repeat headings)', () => {
  const fields = [
    { id: 7, type: 'heading', label: 'Unit', repeat: true, itemLabel: 'Unit' },
    num(8),
    num(9, { condition: { fieldId: 8, operator: 'greater_than', value: '0' } }),
    { id: 1, type: 'heading', label: 'Area' },
    num(2),
    num(3, { condition: { fieldId: 8, operator: 'greater_than', value: '4' } }),
  ];

  test('normaliseFormFields keeps repeat and itemLabel on headings only', () => {
    const { fields: cleaned, error } = normaliseFormFields(
      [{ id: 1, type: 'heading', label: 'Unit', repeat: true, itemLabel: ' Unit ' }, num(2), { id: 3, type: 'heading', label: 'Area', repeat: 'yes' }],
      { savedIds: [], nextFieldId: 1 },
    );
    expect(error).toBeUndefined();
    expect(cleaned[0]).toEqual({ id: 1, type: 'heading', label: 'Unit', repeat: true, itemLabel: 'Unit' });
    expect(cleaned[2].repeat).toBeUndefined();
  });

  test('a rule outside the section may use a per-unit number (its total) but not other types', () => {
    const ok = normaliseFormFields(fields, { savedIds: [], nextFieldId: 1 });
    expect(ok.error).toBeUndefined();
    const bad = normaliseFormFields([
      { id: 1, type: 'heading', label: 'Unit', repeat: true },
      { id: 2, type: 'text', label: 'Venue' },
      { id: 3, type: 'heading', label: 'Area' },
      num(4, { condition: { fieldId: 2, operator: 'is_not_empty' } }),
    ], { savedIds: [], nextFieldId: 1 });
    expect(bad.error).toMatch(/per-unit/);
  });

  test('stores each named unit and the totals as the section answers', () => {
    const { answers, numbers, errors } = validateAnswers(fields, {
      g7: [{ name: ' Kovoor ', f8: 3, f9: 1 }, { name: 'Palazhi', f8: '2', f9: 4, junk: 1 }],
      f8: 999, // a client-sent total is ignored
      f2: 1,
      f3: 6,
    });
    expect(errors).toEqual([]);
    expect(answers.g7).toEqual([{ name: 'Kovoor', f8: 3, f9: 1 }, { name: 'Palazhi', f8: 2, f9: 4 }]);
    expect(answers).toMatchObject({ f8: 5, f9: 5, f2: 1, f3: 6 });
    expect(numbers).toEqual([{ fieldId: 8, value: 5 }, { fieldId: 9, value: 5 }, { fieldId: 2, value: 1 }, { fieldId: 3, value: 6 }]);
  });

  test('shown-when rules inside a unit read that unit; outside they read the total', () => {
    const { answers, errors } = validateAnswers(fields, {
      g7: [{ name: 'A', f8: 0, f9: 7 }, { name: 'B', f8: 1 }],
      f2: 0,
      f3: 1,
    });
    // A held no meeting, so its f9 is hidden and dropped; B must answer f9
    expect(errors).toEqual([expect.objectContaining({ fieldId: 9, entry: 1, message: expect.stringMatching(/^B: /) })]);
    expect(answers.g7[0]).toEqual({ name: 'A', f8: 0 });
    // Total f8 = 1, not more than 4: f3 is hidden
    expect(answers.f3).toBeUndefined();
  });

  test('needs at least one unit, a name on each, and no name twice', () => {
    expect(validateAnswers(fields, { f2: 1 }).errors[0]).toMatchObject({ fieldId: 7, message: expect.stringMatching(/at least one unit/) });
    const { errors } = validateAnswers(fields, { g7: [{ name: '', f8: 0 }, { name: 'x', f8: 0 }, { name: 'X', f8: 0 }], f2: 0 });
    expect(errors.map(e => [e.fieldId, e.entry])).toEqual([[7, 0], [7, 2]]);
  });

  test('repeatedFieldIds maps questions to their repeating heading', () => {
    expect([...repeatedFieldIds(fields)]).toEqual([[8, 7], [9, 7]]);
  });

  test('changedFieldIds names the heading when the unit list changes', () => {
    expect(changedFieldIds({ g7: [{ name: 'A', f8: 1 }], f8: 1 }, { g7: [{ name: 'A', f8: 2 }], f8: 2 })).toEqual([7, 8]);
  });

  test('canUpgradeForm: a newer form must keep every answered question and its type', () => {
    const v3 = [{ id: 7, type: 'heading', label: 'Unit' }, num(8), num(2)];
    const v4 = [{ id: 7, type: 'heading', label: 'Unit', repeat: true }, num(8), num(2), num(11)];
    expect(canUpgradeForm(v3, v4)).toBe(true);
    expect(canUpgradeForm(v3, [num(8)])).toBe(false);
    expect(canUpgradeForm(v3, [num(8), { id: 2, type: 'text', label: 'x' }])).toBe(false);
  });

  test('the seeded area form fills units one by one', () => {
    expect(DEFAULT_FORMS.area.fields[0]).toMatchObject({ id: 7, type: 'heading', repeat: true });
  });
});
