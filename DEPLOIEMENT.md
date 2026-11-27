# Déploiement

## État actuel

| | |
| --- | --- |
| Dépôt | [github.com/louskyfly/studio](https://github.com/louskyfly/studio) (public) |
| Site | [https://louskyfly.github.io/studio/](https://louskyfly.github.io/studio/) |
| Branche publiée | `gh-pages` (build statique, `.nojekyll`) |
| Source Pages | `gh-pages` / racine |
| Vérifié | HTTP 200, application chargée, démo 7 diapositives, service worker actif |

> Le compte `louskyfly` a été retenu sur demande explicite du propriétaire, alors que le brief initial demandait un autre compte. Ce choix est assumé et documenté ici.

## Mettre à jour le site

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-pages.ps1
```

ou :

```powershell
npm run deploy
```

Le script :

1. construit le projet (`npm run build`, types compris) ;
2. copie `dist/` dans un dossier temporaire ;
3. y crée un dépôt `gh-pages` et force le push vers `origin` ;
4. ajoute `.nojekyll`.

GitHub Pages reconstruit en une à deux minutes.

## Pourquoi pas GitHub Actions ?

Le workflow existe, prêt à l’emploi : `scripts/github-pages-workflow.yml`. Il n’a pas pu être poussé dans `.github/workflows/` car le jeton OAuth de `gh` n’a pas le scope **workflow** ; GitHub refuse alors tout le push.

Pour l’activer plus tard :

```powershell
gh auth refresh -h github.com -s workflow
mkdir .github\workflows
copy scripts\github-pages-workflow.yml .github\workflows\deploy.yml
git add .github/workflows/deploy.yml
git commit -m "Active le deploiement GitHub Actions"
git push
```

Puis *Settings → Pages → Source : GitHub Actions*. Le workflow reconstruit et publie à chaque push sur `main`.

## Autre compte GitHub

Le script `scripts/deploy-github.ps1` reste disponible pour un dépôt sur un autre compte. Il refuse `louskyfly` par défaut ; ajouter `-AllowMainAccount` pour passer outre.

```powershell
gh auth login
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-github.ps1 -Repo studio
```

## Clés IA

Aucune variable d’environnement, aucun secret dans le dépôt. La clé du modèle est saisie par l’utilisateur dans **Réglages → Intelligence artificielle** et reste dans le navigateur de l’appareil.
