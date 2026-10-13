/** En Argentina se es mayor de edad a los 18. */
export const ADULT_AGE = 18;

/**
 * Si la persona es menor de edad. La planilla de papel a veces trae la edad en
 * lugar de la fecha de nacimiento, y la edad envejece: por eso se guarda con la
 * fecha en que se tomó y acá se le suman los años que pasaron.
 *
 * Devuelve null cuando no hay con qué saberlo, que no es lo mismo que "es mayor":
 * una ficha sin fecha de nacimiento no autoriza a entregarle los anteojos a nadie.
 */
export function isMinor(
  person: { birthDate?: Date | string | null; ageAtIntake?: number | null; ageTakenAt?: Date | string | null },
  today: Date = new Date(),
): boolean | null {
  const age = ageOf(person, today);
  return age === null ? null : age < ADULT_AGE;
}

/** La edad de hoy, calculada de la fecha de nacimiento o estimada de la edad cargada. */
export function ageOf(
  person: { birthDate?: Date | string | null; ageAtIntake?: number | null; ageTakenAt?: Date | string | null },
  today: Date = new Date(),
): number | null {
  if (person.birthDate) {
    const birth = new Date(person.birthDate);
    if (!Number.isNaN(birth.getTime())) {
      let age = today.getFullYear() - birth.getFullYear();
      const cumpleEsteAnio =
        today.getMonth() > birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
      if (!cumpleEsteAnio) age -= 1;
      return age;
    }
  }

  if (person.ageAtIntake === null || person.ageAtIntake === undefined) return null;
  if (!person.ageTakenAt) return person.ageAtIntake;

  const taken = new Date(person.ageTakenAt);
  if (Number.isNaN(taken.getTime())) return person.ageAtIntake;
  const anios = Math.floor((today.getTime() - taken.getTime()) / (365.25 * 86_400_000));
  return person.ageAtIntake + Math.max(0, anios);
}
