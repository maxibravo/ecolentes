import { pairsFromText, parsePrescription } from '@ecolentes/shared';

describe('graduación escrita en la planilla', () => {
  it('lee lejos de los dos ojos y la adición de cerca', () => {
    const r = parsePrescription('LEJOS OD 180°-3,50 // OI 180°-2,75 - CERCA ADD+1,50 AO');
    expect(r).toEqual({
      farRightSphere: -3.5,
      farRightCylinder: null,
      farRightAxis: 180,
      farLeftSphere: -2.75,
      farLeftCylinder: null,
      farLeftAxis: 180,
      nearAddition: 1.5,
    });
  });

  it('entiende NEUTRO como cero', () => {
    const r = parsePrescription('LEJOS OD 2°-0,50 // OI NEUTRO');
    expect(r.farRightSphere).toBe(-0.5);
    expect(r.farLeftSphere).toBe(0);
    expect(r.nearAddition).toBeNull();
  });

  it('lee esfera y cilindro cuando vienen los dos', () => {
    const r = parsePrescription('LEJOS OD 28°-0,25+0,25 // OI 11°-0,25-0,25 - CERCA ADD+1,50 AO');
    expect(r.farRightSphere).toBe(-0.25);
    expect(r.farRightCylinder).toBe(0.25);
    expect(r.farLeftSphere).toBe(-0.25);
    expect(r.farLeftCylinder).toBe(-0.25);
  });

  it('funciona sin eje', () => {
    const r = parsePrescription('LEJOS OD +0,25 // OI +0,50');
    expect(r.farRightSphere).toBe(0.25);
    expect(r.farRightAxis).toBeNull();
    expect(r.farLeftSphere).toBe(0.5);
  });

  it('acepta números enteros', () => {
    const r = parsePrescription('LEJOS OD 1°-2 // OI 9°-2');
    expect(r.farRightSphere).toBe(-2);
    expect(r.farLeftSphere).toBe(-2);
    expect(r.farLeftAxis).toBe(9);
  });

  it('lee el caso de tres valores dejando el resto a mano', () => {
    const r = parsePrescription('LEJOS OD 179°-1,25 // OI 153°-3,75-1,75');
    expect(r.farLeftSphere).toBe(-3.75);
    expect(r.farLeftCylinder).toBe(-1.75);
    expect(r.farLeftAxis).toBe(153);
  });

  it('no inventa nada cuando el texto no se entiende', () => {
    const r = parsePrescription('la receta está en papel, pedirla a la óptica');
    expect(Object.values(r).every((v) => v === null)).toBe(true);
  });

  it('cuenta dos pares cuando hay graduación de cerca', () => {
    expect(pairsFromText('LEJOS OD 180°-3,50 // OI 180°-2,75 - CERCA ADD+1,50 AO')).toBe(2);
    expect(pairsFromText('LEJOS OD 2°-0,50 // OI NEUTRO')).toBe(1);
  });
});
