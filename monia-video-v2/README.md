# MonIA Video V2 — générateur parallèle

Objectif : construire le futur moteur vidéo gratuit de MonIA sans toucher au générateur actuel.

## Isolation

Ce V2 utilise exclusivement :
- `.monia-render-queue-v2/`
- `kaggle/monia-video-v2/`
- `config/monia-video-v2.json`
- `public/resources/monia-v2/candidates/`
- `.github/workflows/monia-video-v2-kaggle.yml`

Le pipeline historique n'est ni appelé ni modifié.

## Phase 1

Test d'identité simple :
- 1 personnage canonique ;
- image de référence obligatoire ;
- 4 secondes environ ;
- mouvement naturel léger ;
- aucune voix ;
- aucune publication automatique dans le jeu.

Le moteur GPU de départ est LTX-Video via Diffusers, uniquement comme moteur open source sous l'orchestration MonIA V2. Il pourra être remplacé ensuite sans changer le contrat de job.

## Contrat de job

Exemple : `.monia-render-queue-v2/lucas-motion-proof-v1.json`.

Le worker ne génère que des candidats. Il ne modifie jamais les manifests live et ne remplace aucune cinématique existante.

## Validation

Un test est considéré réussi seulement si :
1. le visage reste reconnaissable ;
2. le mouvement est naturel ;
3. la vidéo est lisible ;
4. le résultat est écrit dans `public/resources/monia-v2/candidates/<jobId>/`.

Ensuite seulement on ajoute : plans multiples, duo, visio, voix et lip-sync.
