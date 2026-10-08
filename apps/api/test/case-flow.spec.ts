import { canMove, isOverdue, STAGE_RULES } from '@ecolentes/shared';

describe('circuito del expediente', () => {
  it('sigue el orden confirmado con Salud', () => {
    expect(STAGE_RULES.REQUEST.next).toEqual(['ASSESSMENT']);
    expect(STAGE_RULES.ASSESSMENT.next).toEqual(['OPTICIAN_QUOTE']);
    expect(STAGE_RULES.OPTICIAN_QUOTE.next).toEqual(['APPROVAL']);
    expect(STAGE_RULES.PRODUCTION.next).toEqual(['RECEIVED']);
    expect(STAGE_RULES.CLOSED.next).toEqual([]);
  });

  it('deja que Dirección apruebe o devuelva a la óptica', () => {
    expect(canMove('APPROVAL', 'PRODUCTION', 'DIRECTOR')).toBe(true);
    expect(canMove('APPROVAL', 'OPTICIAN_QUOTE', 'DIRECTOR')).toBe(true);
  });

  it('no deja que la óptica se apruebe su propia propuesta', () => {
    expect(canMove('APPROVAL', 'PRODUCTION', 'OPTICIAN')).toBe(false);
    expect(canMove('APPROVAL', 'PRODUCTION', 'OPERATOR')).toBe(false);
  });

  it('no deja saltear etapas', () => {
    expect(canMove('REQUEST', 'PRODUCTION', 'ADMIN')).toBe(false);
    expect(canMove('ASSESSMENT', 'DELIVERED', 'OPERATOR')).toBe(false);
  });

  it('sólo el oftalmólogo cierra la evaluación', () => {
    expect(canMove('ASSESSMENT', 'OPTICIAN_QUOTE', 'OPHTHALMOLOGIST')).toBe(true);
    expect(canMove('ASSESSMENT', 'OPTICIAN_QUOTE', 'OPERATOR')).toBe(false);
  });

  it('marca la demora según el plazo de cada etapa', () => {
    const hace10Dias = new Date(Date.now() - 10 * 86_400_000);
    // Aprobación tiene 3 días de plazo; evaluación tiene 15.
    expect(isOverdue('APPROVAL', hace10Dias)).toBe(true);
    expect(isOverdue('ASSESSMENT', hace10Dias)).toBe(false);
  });

  it('un expediente cerrado nunca está demorado', () => {
    expect(isOverdue('CLOSED', new Date('2020-01-01'))).toBe(false);
  });
});
