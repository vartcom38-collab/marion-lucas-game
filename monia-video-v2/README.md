# MonIA Video V2 — générateur parallèle

Objectif : construire le futur moteur vidéo gratuit de MonIA sans toucher au générateur actuel.

## Nom canonique

Le personnage masculin principal s'appelle désormais **Dominic**.

Les anciens identifiants techniques contenant `lucas` sont conservés uniquement comme compatibilité avec les références historiques déjà présentes dans le dépôt. Ils ne doivent plus être utilisés comme nom de personnage dans les nouveaux jobs, prompts ou sorties.

## Isolation

Ce V2 utilise exclusivement :
- `.monia-render-queue-v2/`
- `kaggle/monia-video-v2/`
- `config/monia-video-v2.json`
- `public/resources/monia-v2/candidates/`

Le pipeline historique n'est ni remplacé ni utilisé comme source vidéo.

## Règle de génération

Les anciennes vidéos servent seulement de références de mouvement, présence et micro-expressions. Elles ne doivent jamais être utilisées comme vidéo source ou comme scène finale.

Une génération V2 doit créer une **nouvelle scène** avec :
- identité canonique de Dominic ;
- nouveau décor ;
- nouvelle action ;
- nouveau cadrage ;
- aucun recyclage de footage existant.

## Validation

Un test est réussi seulement si :
1. Dominic reste reconnaissable ;
2. le mouvement est naturel ;
3. la scène est réellement nouvelle ;
4. aucune vidéo existante n'a servi d'entrée au rendu ;
5. le résultat reste candidat et n'est pas publié automatiquement dans le jeu.
