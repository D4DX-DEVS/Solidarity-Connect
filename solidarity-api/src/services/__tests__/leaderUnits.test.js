import { attachLeaderUnits } from '../leaderUnits.js';

const findNone = async () => [];

describe('attachLeaderUnits', () => {
  test('member unit leader takes the unit from their address', async () => {
    const leaders = [{ phone: '9000000001', address: 'Vaduthala Jetty', roleTag: { type: 'unit', name: 'President' } }];
    await attachLeaderUnits(leaders, findNone);
    expect(leaders[0].unit).toBe('Vaduthala Jetty');
  });

  test('unit held as an extra role still gets the unit', async () => {
    const leaders = [{ phone: '9000000002', address: 'Kollam', roleTag: { type: 'area' }, extraRoleTags: [{ type: 'unit', name: 'Secretary' }] }];
    await attachLeaderUnits(leaders, findNone);
    expect(leaders[0].unit).toBe('Kollam');
  });

  test('admin login looks the unit up on the Member with the same phone', async () => {
    const leaders = [{ phone: '+919961951910', role: 'group_admin', roleTag: { type: 'murabi' }, extraRoleTags: [{ type: 'unit', name: 'President' }] }];
    const find = async (phones) => {
      expect(phones).toEqual(expect.arrayContaining(['9961951910', '+919961951910']));
      return [{ phone: '9961951910', address: 'Thaikkattukara' }];
    };
    await attachLeaderUnits(leaders, find);
    expect(leaders[0].unit).toBe('Thaikkattukara');
  });

  test('falls back to the unit tag description when no address is known', async () => {
    const leaders = [{ phone: '9000000003', roleTag: { type: 'unit', name: 'President', roleDescription: 'Alissery' } }];
    await attachLeaderUnits(leaders, findNone);
    expect(leaders[0].unit).toBe('Alissery');
  });

  test('non-unit leaders get no unit, and no address ever leaves', async () => {
    const leaders = [
      { phone: '9000000004', address: 'Home Unit', roleTag: { type: 'district' } },
      { phone: '9000000005', address: 'Paybazar', roleTag: { type: 'unit' } },
    ];
    await attachLeaderUnits(leaders, findNone);
    expect(leaders[0]).not.toHaveProperty('unit');
    expect(leaders.some((l) => 'address' in l)).toBe(false);
  });

  test('skips the Member lookup when every unit leader has an address', async () => {
    let calls = 0;
    const find = async () => { calls += 1; return []; };
    await attachLeaderUnits([{ phone: '9000000006', address: 'Edathara', roleTag: { type: 'unit' } }], find);
    expect(calls).toBe(0);
  });
});
