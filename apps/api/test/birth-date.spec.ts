import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreatePersonDto } from '../src/persons/dto';

/** Los errores de un alta, por campo. */
async function errores(body: Record<string, unknown>) {
  const dto = plainToInstance(CreatePersonDto, {
    dni: '31620034',
    firstName: 'Mirta',
    lastName: 'Juárez',
    ...body,
  });
  return (await validate(dto)).map((e) => e.property);
}

describe('fecha de nacimiento al cargar una ficha', () => {
  it('acepta una fecha normal', async () => {
    expect(await errores({ birthDate: '1984-03-11' })).toEqual([]);
  });

  it('no acepta una fecha futura: suele ser un año mal tipeado', async () => {
    expect(await errores({ birthDate: '2206-03-11' })).toContain('birthDate');
  });

  it('no acepta a alguien de más de 120 años', async () => {
    expect(await errores({ birthDate: '1850-03-11' })).toContain('birthDate');
  });

  it('sigue aceptando la ficha sin fecha, con la edad cargada en territorio', async () => {
    expect(await errores({ ageAtIntake: 46 })).toEqual([]);
  });

  it('sigue aceptando la ficha sin fecha ni edad: el formulario público no las pide', async () => {
    expect(await errores({})).toEqual([]);
  });
});
