export type RelationshipChronologySave={
  metDominic?:boolean;
  official?:boolean;
  flags?:Record<string,unknown>;
};

/**
 * Canonical meeting authority.
 *
 * Runtime chronology must never infer the meeting from relationship status or
 * legacy compatibility flags. Old saves are migrated elsewhere; after loading,
 * metDominic is the single source of truth.
 */
export function hasMetDominic(save:RelationshipChronologySave|null|undefined){
  return save?.metDominic===true;
}

export function hasFirstDominicMessage(save:RelationshipChronologySave|null|undefined){
  return hasMetDominic(save)&&save?.flags?.firstMessage===true;
}

export function canDominicUsePhoneAutonomously(save:RelationshipChronologySave|null|undefined){
  return hasFirstDominicMessage(save);
}

export function assertDominicChronology(save:RelationshipChronologySave|null|undefined){
  return {
    met:hasMetDominic(save),
    firstMessage:hasFirstDominicMessage(save),
    phoneAutonomy:canDominicUsePhoneAutonomously(save),
  };
}
