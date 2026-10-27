import { ParliamentarianEntity } from '@src/legislative/entities/parliamentarian.entity';
import { VotingEntity } from '@src/legislative/entities/voting.entity';
import { VoteEntity } from '@src/legislative/entities/vote.entity';

/** Respostas públicas: só campos de interesse do cidadão, sem metadados internos. */
export const toVotingResponse = (v: VotingEntity) => ({
  id: v.id,
  chamber: v.chamber,
  date: v.date,
  propositionType: v.propositionType,
  propositionLabel: v.propositionLabel,
  summary: v.summary,
  description: v.description,
  result: v.result,
  isSecret: v.isSecret,
  sourceUrl: v.sourceUrl,
  counts: {
    yes: v.yesCount,
    no: v.noCount,
    abstention: v.abstentionCount,
    absent: v.absentCount,
    justifiedAbsence: v.justifiedAbsenceCount,
    other: v.otherCount,
  },
});

export const toParliamentarianResponse = (p: ParliamentarianEntity) => ({
  id: p.id,
  chamber: p.chamber,
  name: p.name,
  party: p.party,
  state: p.state,
  photoUrl: p.photoUrl,
});

export const toVoteOfVotingResponse = (vote: VoteEntity) => ({
  type: vote.type,
  rawValue: vote.rawValue,
  party: vote.partyAtVote,
  state: vote.stateAtVote,
  parliamentarian: toParliamentarianResponse(vote.parliamentarian!),
});

export const toVoteOfParliamentarianResponse = (vote: VoteEntity) => ({
  type: vote.type,
  rawValue: vote.rawValue,
  voting: toVotingResponse(vote.voting!),
});
