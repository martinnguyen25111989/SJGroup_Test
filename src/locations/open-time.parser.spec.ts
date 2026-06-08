import { parseOpenTime } from './open-time.parser';

describe('parseOpenTime', () => {
  it('parses "Always open"', () => {
    expect(parseOpenTime('Always open')).toEqual({
      isAlwaysOpen: true,
      startDay: null,
      endDay: null,
      startTime: null,
      endTime: null,
    });
  });

  it('treats "24/7" as always open', () => {
    expect(parseOpenTime('24/7').isAlwaysOpen).toBe(true);
  });

  it('parses a "Mon to Fri" weekday range', () => {
    expect(parseOpenTime('Mon to Fri', '09:00-18:00')).toEqual({
      isAlwaysOpen: false,
      startDay: 1,
      endDay: 5,
      startTime: '09:00',
      endTime: '18:00',
    });
  });

  it('parses a "Mon-Sun" range with dash', () => {
    expect(parseOpenTime('Mon-Sun', '08:00-22:00')).toMatchObject({
      startDay: 1,
      endDay: 0,
      startTime: '08:00',
      endTime: '22:00',
    });
  });

  it('parses a single-day range', () => {
    expect(parseOpenTime('Wednesday', '10:00-12:00')).toMatchObject({
      startDay: 3,
      endDay: 3,
    });
  });

  it('pads single-digit hours', () => {
    expect(parseOpenTime('Mon to Fri', '9:00-18:00').startTime).toBe('09:00');
  });

  it('throws on unrecognised day', () => {
    expect(() => parseOpenTime('Funday', '09:00-18:00')).toThrow(/Unrecognised day/);
  });

  it('throws on missing time range when not always open', () => {
    expect(() => parseOpenTime('Mon to Fri')).toThrow(/Time range required/);
  });

  it('throws on bad time format', () => {
    expect(() => parseOpenTime('Mon to Fri', '9am-6pm')).toThrow(/Unrecognised time range/);
  });
});
