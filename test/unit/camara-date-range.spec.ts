import {
  camaraVotingsQueryRange,
  isWithinRange,
} from '@src/legislative/clients/camara-date-range';

describe('camaraVotingsQueryRange', () => {
  it('consulta até o dia seguinte (dataFim exclusivo na API da Câmara)', () => {
    expect(camaraVotingsQueryRange('2026-05-27', '2026-05-27')).toEqual({
      dataInicio: '2026-05-27',
      dataFim: '2026-05-28',
    });
  });

  it('vira o mês corretamente', () => {
    expect(camaraVotingsQueryRange('2026-10-22', '2026-10-31').dataFim).toBe(
      '2026-11-01',
    );
  });

  it('descarta datas fora do intervalo pedido', () => {
    expect(isWithinRange('2026-05-27', '2026-05-27', '2026-05-27')).toBe(true);
    expect(isWithinRange('2026-05-28', '2026-05-27', '2026-05-27')).toBe(false);
  });
});
