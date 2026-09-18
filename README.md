# Marion & Dominic

Jeu de vie cinématographique photoréaliste en développement.

## Infrastructure autoritaire

Le projet utilise uniquement :

- **GitHub** pour le code source, les commits et GitHub Actions ;
- **MonIA** pour la génération, la mise en scène et les médias IA du jeu ;
- **Infomaniak** pour l’hébergement de production.

Déploiement de production :

`main` → **Vite CI** → **Deploy to Infomaniak** → `https://marion-lucas.marionbolomey.fr`

Aucun autre hébergeur ou pipeline de déploiement n’est autoritaire pour ce projet.
