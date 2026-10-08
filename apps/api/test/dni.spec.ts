import { formatDni, isValidDni, normalizeDni } from '../src/common/dni';

describe('DNI', () => {
  it('saca los puntos y los espacios que trae la planilla de papel', () => {
    expect(normalizeDni('31.620.034')).toBe('31620034');
    expect(normalizeDni(' 24.059.914 ')).toBe('24059914');
    expect(normalizeDni('12161047')).toBe('12161047');
  });

  it('acepta 7 y 8 dígitos y rechaza el resto', () => {
    expect(isValidDni('12.161.047')).toBe(true);
    expect(isValidDni('9876543')).toBe(true);
    expect(isValidDni('123456')).toBe(false);
    expect(isValidDni('123456789')).toBe(false);
    expect(isValidDni('0000000')).toBe(false);
    expect(isValidDni('no es un dni')).toBe(false);
  });

  it('lo muestra como en la planilla', () => {
    expect(formatDni('31620034')).toBe('31.620.034');
    expect(formatDni('9876543')).toBe('9.876.543');
  });

  it('trata como el mismo DNI al escrito de dos formas', () => {
    expect(normalizeDni('31.620.034')).toBe(normalizeDni('31620034'));
  });
});
