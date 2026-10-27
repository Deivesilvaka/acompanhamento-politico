import { Injectable } from '@nestjs/common';
import { OfficialHttpClient } from '@src/legislative/clients/official-http.client';
import {
  camaraVotingsQueryRange,
  isWithinRange,
} from '@src/legislative/clients/camara-date-range';
import {
  asArray,
  asInteger,
  asIsoDate,
  asState,
  asString,
  isObject,
  JsonObject,
} from '@src/legislative/clients/payload-guards';
import {
  CAMARA_API_BASE_URL,
  CAMARA_PLENARY_ID,
} from '@src/legislative/constants/official-sources';

export interface CamaraVotingSummary {
  id: string;
  date: string;
  registeredAt: string | null;
  description: string;
}

export interface CamaraProposition {
  id: number;
  type: string;
  number: number;
  year: number;
  summary: string;
}

export interface CamaraVotingDetail {
  approved: boolean | null;
  propositions: CamaraProposition[];
}

export interface CamaraDeputy {
  id: number;
  name: string;
  party: string | null;
  state: string | null;
  photoUrl: string | null;
}

export interface CamaraVote {
  deputy: CamaraDeputy;
  voteType: string;
}

const PAGE_SIZE = 200;
const MAX_PAGES = 50;

@Injectable()
export class CamaraClient {
  constructor(private readonly http: OfficialHttpClient) {}

  async listPlenaryVotings(
    from: string,
    to: string,
  ): Promise<CamaraVotingSummary[]> {
    const params = new URLSearchParams({
      idOrgao: String(CAMARA_PLENARY_ID),
      ...camaraVotingsQueryRange(from, to),
      itens: String(PAGE_SIZE),
      ordem: 'ASC',
      ordenarPor: 'dataHoraRegistro',
    });
    const items = await this.paginate(
      `${CAMARA_API_BASE_URL}/votacoes?${params}`,
    );

    return items.flatMap((item) => {
      const id = asString(item.id, 50);
      const date = asIsoDate(item.data);
      if (!id || !date || !/^[\w-]+$/.test(id)) return [];
      if (!isWithinRange(date, from, to)) return [];
      return [
        {
          id,
          date,
          registeredAt: asString(item.dataHoraRegistro, 30),
          description: asString(item.descricao) ?? '',
        },
      ];
    });
  }

  async getVotingDetail(id: string): Promise<CamaraVotingDetail> {
    const payload = await this.http.getJson(
      `${CAMARA_API_BASE_URL}/votacoes/${encodeURIComponent(id)}`,
    );
    const data =
      isObject(payload) && isObject(payload.dados) ? payload.dados : {};
    const approval = asInteger(data.aprovacao);

    return {
      approved: approval === null ? null : approval === 1,
      propositions: asArray(data.proposicoesAfetadas).flatMap((raw) => {
        if (!isObject(raw)) return [];
        const propositionId = asInteger(raw.id);
        const type = asString(raw.siglaTipo, 10);
        if (!propositionId || !type) return [];
        return [
          {
            id: propositionId,
            type,
            number: asInteger(raw.numero) ?? 0,
            year: asInteger(raw.ano) ?? 0,
            summary: asString(raw.ementa) ?? '',
          },
        ];
      }),
    };
  }

  async getVotes(id: string): Promise<CamaraVote[]> {
    const payload = await this.http.getJson(
      `${CAMARA_API_BASE_URL}/votacoes/${encodeURIComponent(id)}/votos`,
    );
    const items = isObject(payload) ? asArray(payload.dados) : [];

    return items.flatMap((raw) => {
      if (!isObject(raw) || !isObject(raw.deputado_)) return [];
      const deputy = this.toDeputy(raw.deputado_);
      const voteType = asString(raw.tipoVoto, 60);
      return deputy && voteType ? [{ deputy, voteType }] : [];
    });
  }

  /** Deputados em exercício na data — base para saber quem não registrou voto. */
  async listDeputiesInOffice(date: string): Promise<CamaraDeputy[]> {
    const params = new URLSearchParams({
      dataInicio: date,
      dataFim: date,
      itens: '1000',
      ordem: 'ASC',
      ordenarPor: 'nome',
    });
    const items = await this.paginate(
      `${CAMARA_API_BASE_URL}/deputados?${params}`,
    );
    return items.flatMap((item) => {
      const deputy = this.toDeputy(item);
      return deputy ? [deputy] : [];
    });
  }

  private toDeputy(raw: JsonObject): CamaraDeputy | null {
    const id = asInteger(raw.id);
    const name = asString(raw.nome, 150);
    if (!id || !name) return null;
    return {
      id,
      name,
      party: asString(raw.siglaPartido, 30),
      state: asState(raw.siglaUf),
      photoUrl: asString(raw.urlFoto, 255),
    };
  }

  private async paginate(firstUrl: string): Promise<JsonObject[]> {
    const results: JsonObject[] = [];
    let nextUrl: string | null = firstUrl;

    for (let page = 0; nextUrl && page < MAX_PAGES; page++) {
      const payload = await this.http.getJson(nextUrl);
      if (!isObject(payload)) break;

      results.push(...asArray(payload.dados).filter(isObject));

      const next = asArray(payload.links).find(
        (link) => isObject(link) && link.rel === 'next',
      );
      const href = isObject(next) ? asString(next.href, 1000) : null;
      // O link de paginação vem da resposta: revalida o host antes de seguir.
      nextUrl = href ? this.http.assertAllowedUrl(href).toString() : null;
    }

    return results;
  }
}
