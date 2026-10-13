import { ADULT_AGE, ageOf, isMinor } from '@ecolentes/shared';

const hoy = new Date('2026-10-13T12:00:00Z');

describe('edad y mayoría de edad', () => {
  it('calcula la edad de la fecha de nacimiento', () => {
    expect(ageOf({ birthDate: '1984-03-11' }, hoy)).toBe(42);
  });

  it('no suma el año antes del cumpleaños', () => {
    expect(ageOf({ birthDate: '1984-12-20' }, hoy)).toBe(41);
  });

  it('un chico de 2015 es menor', () => {
    expect(isMinor({ birthDate: '2015-08-07' }, hoy)).toBe(true);
  });

  it('el día que cumple 18 ya es mayor', () => {
    expect(isMinor({ birthDate: '2008-10-13' }, hoy)).toBe(false);
    expect(ageOf({ birthDate: '2008-10-13' }, hoy)).toBe(ADULT_AGE);
  });

  it('envejece la edad anotada en la planilla', () => {
    // 16 años anotados hace tres: hoy tiene 19 y ya no es menor.
    const person = { ageAtIntake: 16, ageTakenAt: '2023-10-13' };
    expect(ageOf(person, hoy)).toBe(19);
    expect(isMinor(person, hoy)).toBe(false);
  });

  it('sin fecha ni edad no afirma que sea mayor', () => {
    expect(isMinor({ birthDate: null, ageAtIntake: null }, hoy)).toBeNull();
    expect(ageOf({}, hoy)).toBeNull();
  });
});
