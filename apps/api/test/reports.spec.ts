import { seesIdentityInReports, suppressSmallCell } from '@ecolentes/shared';

describe('quién ve identidades en los reportes', () => {
  it('deja ver nombre y DNI a quien atiende a la persona', () => {
    expect(seesIdentityInReports('OPERATOR')).toBe(true);
    expect(seesIdentityInReports('OPHTHALMOLOGIST')).toBe(true);
    expect(seesIdentityInReports('SOCIAL_DESK')).toBe(true);
    expect(seesIdentityInReports('ADMIN')).toBe(true);
  });

  it('no se la deja ver a Dirección ni a la óptica', () => {
    // Dirección aprueba y mide sin saber de quién se trata.
    expect(seesIdentityInReports('DIRECTOR')).toBe(false);
    expect(seesIdentityInReports('OPTICIAN')).toBe(false);
  });
});

describe('suppressSmallCell', () => {
  it('tapa los números que identifican a una persona en un barrio chico', () => {
    expect(suppressSmallCell(1)).toBeNull();
    expect(suppressSmallCell(2)).toBeNull();
  });

  it('deja pasar el cero y los números que ya no identifican a nadie', () => {
    expect(suppressSmallCell(0)).toBe(0);
    expect(suppressSmallCell(3)).toBe(3);
    expect(suppressSmallCell(14)).toBe(14);
  });
});
