# Déploiement sur GitHub — compte dédié

Le dépôt doit vivre sur **un autre compte GitHub que le compte habituel** (`louskyfly`). Ce script refuse de publier si le compte actif est justement `louskyfly`.

Aucun jeton n’est écrit dans le projet : l’authentification passe par `gh`, qui stocke le jeton dans le trousseau du système.

## 1. Se connecter avec le compte dédié

Dans **ton** terminal PowerShell (pas dans l’agent) :

```powershell
gh auth login
```

Choisir `GitHub.com`, `HTTPS`, `Login with a web browser`, puis se connecter avec **l’autre compte**. Vérifier :

```powershell
gh api user --jq .login
```

La commande doit afficher le compte dédié, pas `louskyfly`.

## 2. Créer le dépôt et publier

Depuis le dossier du projet :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-github.ps1 -Repo studio
```

Le script :

1. vérifie le compte actif ;
2. crée le dépôt public `studio` (Pages gratuit) et pousse `main` ;
3. active GitHub Pages en mode **GitHub Actions** ;
4. attend le déploiement et affiche l’URL.

Pour un dépôt privé (nécessite GitHub Pro pour Pages) :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-github.ps1 -Repo studio -Private
```

## 3. Vérifier

- Actions : l’onglet *Actions* du dépôt doit montrer « Déployer Studio » en vert.
- URL : `https://<compte>.github.io/studio/`.
- Ouvrir l’URL, créer une présentation, vérifier qu’elle survit à un rafraîchissement.
- Ajouter la clé IA **dans l’application en ligne** (Réglages → Intelligence artificielle). La clé reste dans le navigateur de l’appareil.

## Mises à jour

```powershell
git add -A
git commit -m "Description du changement"
git push
```

Le workflow republie automatiquement.

## Retour au compte habituel

Une fois le déploiement terminé :

```powershell
gh auth switch --user louskyfly
```
