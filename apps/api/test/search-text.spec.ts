import { searchText } from '../src/common/search-text';

describe('searchText', () => {
  it('saca los acentos para que "juarez" encuentre a Juárez', () => {
    expect(searchText('Juárez', 'Mirta Elena')).toBe('juarez mirta elena');
    expect(searchText('Ibáñez', 'Olga')).toBe('ibanez olga');
    expect(searchText('Ávila')).toBe('avila');
  });

  it('trata la ñ como n, porque nadie la escribe al buscar', () => {
    expect(searchText('Peña')).toBe('pena');
  });

  it('ignora las partes vacías', () => {
    expect(searchText('Sosa', undefined, '  ', null)).toBe('sosa');
  });

  it('escribir con tilde o sin tilde da el mismo texto', () => {
    expect(searchText('Juarez')).toBe(searchText('Juárez'));
  });
});
