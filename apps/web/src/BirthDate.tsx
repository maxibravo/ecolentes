import { ageOf, isMinor } from '@ecolentes/shared';

export type BirthDateValue = { birthDate: string; ageAtIntake: string };

export const EMPTY_BIRTH_DATE: BirthDateValue = { birthDate: '', ageAtIntake: '' };

/** Lo que se le manda a la API: la fecha si la hay, y si no la edad. */
export function birthDateFields(value: BirthDateValue) {
  return {
    ...(value.birthDate ? { birthDate: value.birthDate } : {}),
    ...(!value.birthDate && value.ageAtIntake ? { ageAtIntake: Number(value.ageAtIntake) } : {}),
  };
}

/**
 * La fecha de nacimiento, con la edad a la vista mientras se carga.
 *
 * Se pide la fecha y no la edad porque la edad envejece: una ficha cargada como
 * "17 años" sigue diciendo 17 dos años después, y de la edad depende a quién se
 * le entregan los anteojos. La edad suelta queda como salida de emergencia para
 * territorio, donde a veces la persona no sabe su fecha exacta.
 */
export function BirthDate({
  value,
  onChange,
  hasRepresentative,
}: {
  value: BirthDateValue;
  onChange: (value: BirthDateValue) => void;
  /** Para avisar si es menor y todavía no se cargó quién lo representa. */
  hasRepresentative?: boolean;
}) {
  const persona = {
    birthDate: value.birthDate || null,
    ageAtIntake: value.ageAtIntake ? Number(value.ageAtIntake) : null,
    ageTakenAt: value.ageAtIntake ? new Date() : null,
  };
  const edad = ageOf(persona);
  const menor = isMinor(persona);
  // El navegador no deja elegir una fecha posterior a hoy.
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div>
        <label htmlFor="birthDate">Fecha de nacimiento</label>
        <input
          id="birthDate"
          type="date"
          max={hoy}
          value={value.birthDate}
          onChange={(e) => onChange({ birthDate: e.target.value, ageAtIntake: '' })}
        />
      </div>
      <div>
        <label htmlFor="ageAtIntake">Edad, sólo si no sabe la fecha</label>
        <input
          id="ageAtIntake"
          type="number"
          min="0"
          max="120"
          disabled={value.birthDate !== ''}
          value={value.ageAtIntake}
          onChange={(e) => onChange({ birthDate: '', ageAtIntake: e.target.value })}
        />
      </div>
      <div className="full">
        {edad === null ? (
          <p className="muted">
            Cargá la fecha de nacimiento: de la edad depende si los anteojos se le entregan a la
            persona o a su tutor. Si no la sabe, poné la edad.
          </p>
        ) : menor === true ? (
          <p className="aviso">
            {edad} años: es menor de edad, así que los anteojos se le entregan a su padre, madre o
            tutor.
            {hasRepresentative === false && ' Cargá quién es, abajo.'}
          </p>
        ) : (
          <p className="muted">{edad} años.</p>
        )}
      </div>
    </>
  );
}
