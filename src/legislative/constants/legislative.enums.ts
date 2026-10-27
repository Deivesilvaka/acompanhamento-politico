export enum ChamberEnum {
  CAMARA = 'CAMARA',
  SENADO = 'SENADO',
}

export enum VotingResultEnum {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  UNKNOWN = 'UNKNOWN',
}

export enum VoteTypeEnum {
  YES = 'YES',
  NO = 'NO',
  ABSTENTION = 'ABSTENTION',
  OBSTRUCTION = 'OBSTRUCTION',
  /** Presidente da sessão — regimentalmente não vota (art. 17 RICD / art. 51 RISF). */
  PRESIDING = 'PRESIDING',
  /** Votação secreta: só se sabe que votou. */
  SECRET = 'SECRET',
  PRESENT_NOT_VOTING = 'PRESENT_NOT_VOTING',
  /** Licença, missão oficial ou atividade parlamentar registrada. */
  JUSTIFIED_ABSENCE = 'JUSTIFIED_ABSENCE',
  /** Em exercício e sem voto registrado. */
  ABSENT = 'ABSENT',
  OTHER = 'OTHER',
}
