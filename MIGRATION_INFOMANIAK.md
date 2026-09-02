# Migration Marion & Lucas vers Infomaniak

## Cible

- Source officielle : GitHub
- Hébergement principal : Infomaniak
- Domaine prévu : `marion-lucas.marionbolomey.fr`
- Build : Vite vers `dist/`
- Déploiement : GitHub Actions vers Infomaniak en SFTP
- IA : MonIA reste exécutée localement dans le navigateur

## Sécurité

Aucun identifiant Infomaniak n'est versionné. Le workflow attend uniquement les GitHub Actions Secrets suivants :

- `INFOMANIAK_HOST`
- `INFOMANIAK_USER`
- `INFOMANIAK_PASSWORD`
- `INFOMANIAK_PATH`

Le déploiement est volontairement désactivé tant que la variable GitHub Actions `INFOMANIAK_DEPLOY_ENABLED` n'est pas définie à `true`.

## Protection de l'existant

La version AppDeploy reste intacte pendant toute la migration. L'ancien projet GitHub a été conservé dans la branche `legacy-godot-backup`. La nouvelle version Vite est préparée dans `migration-infomaniak` avant bascule de `main`.

## Ressources Vite

`vite.config.ts` conserve `base: './'` afin que les chemins construits restent relatifs sur un hébergement Web classique. Les fichiers de `public/resources/` doivent être présents avant le passage de la branche de migration en production.

## Sauvegardes navigateur

La sauvegarde actuelle utilise `localStorage` et reste liée à l'origine du site. Une passerelle de migration de sauvegarde sera ajoutée seulement après validation complète de la version Infomaniak, afin de transférer la partie AppDeploy vers le nouveau sous-domaine sans supprimer l'ancienne version prématurément.
