import { Injectable } from '@nestjs/common';
import { OfficialHttpClient } from '@src/legislative/clients/official-http.client';
import {
  asArray,
  asInteger,
  asIsoDate,
  asState,
  asString,
  isObject,
} from '@src/legislative/clients/payload-guards';
import { SENADO_API_BASE_URL } from '@src/legislative/constants/official-sources';

export interface SenadoSenatorVote {
  senatorCode: number;
  name: string;
  party: string | null;
  state: string | null;
  voteCode: string;
}

export interface SenadoVoting {
  id: string;
  date: string;
  matterCode: number | null;
  propositionType: string;
  propositionLabel: string;
  summary: string;
  description: string;
  approved: boolean | null;
  isSecret: boolean;
  votes: SenadoSenatorVote[];
}

@Injectable()
export class SenadoClient {
  constructor(private readonly http: OfficialHttpClient) {}

  async listVotings(from: string, to: string): Promise<SenadoVoting[]> {
    const params = new URLSearchParams({ dataInicio: from, dataFim: to });
    const payload = await this.http.getJson(
      `${SENADO_API_BASE_URL}/votacao?${params}`,
    );

    return asArray(payload).flatMap((raw) => {
      if (!isObject(raw)) return [];

      const sessionCode = asInteger(raw.codigoSessaoVotacao);
      const date = asIsoDate(raw.dataSessao);
      const type = asString(raw.sigla, 10);
      if (!sessionCode || !date || !type) return [];

      const result = asString(raw.resultadoVotacao, 5);
      const identification =
        asString(raw.identificacao, 40) ??
        `${type} ${asString(raw.numero, 10) ?? ''}/${asInteger(raw.ano) ?? ''}`;

      return [
        {
          id: String(sessionCode),
          date,
          matterCode: asInteger(raw.codigoMateria),
          propositionType: type,
          propositionLabel: identification,
          summary: asString(raw.ementa) ?? '',
          description: asString(raw.descricaoVotacao) ?? '',
          approved: result === 'A' ? true : result === 'R' ? false : null,
          isSecret: raw.votacaoSecreta === 'S',
          votes: asArray(raw.votos).flatMap((vote) => {
            if (!isObject(vote)) return [];
            const senatorCode = asInteger(vote.codigoParlamentar);
            const name = asString(vote.nomeParlamentar, 150);
            const voteCode = asString(vote.siglaVotoParlamentar, 60);
            if (!senatorCode || !name || !voteCode) return [];
            return [
              {
                senatorCode,
                name,
                party: asString(vote.siglaPartidoParlamentar, 30),
                state: asState(vote.siglaUFParlamentar),
                voteCode,
              },
            ];
          }),
        },
      ];
    });
  }
}
