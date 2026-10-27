import { addDays } from '@src/shared/helpers/date.helper';

/**
 * Em /votacoes, a API da Câmara trata `dataFim` como EXCLUSIVO: com
 * dataInicio = dataFim não volta nada, e 27..28 só traz o dia 27. Para pedir
 * o intervalo fechado [from, to], consultamos até o dia seguinte.
 * (Em /deputados o fim é inclusivo; não use esta função lá.)
 */
export function camaraVotingsQueryRange(
  from: string,
  to: string,
): { dataInicio: string; dataFim: string } {
  return { dataInicio: from, dataFim: addDays(to, 1) };
}

/** Defesa extra: descarta o que vier fora de [from, to]. */
export const isWithinRange = (date: string, from: string, to: string) =>
  date >= from && date <= to;
