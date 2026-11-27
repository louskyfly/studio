# Studio

**Studio** est un atelier de présentations pédagogiques assisté par IA, pensé pour un professeur d’histoire-géographie. Il génère des diaporamas à partir d’un sujet, de documents ou de notes, les met en page, les laisse entièrement modifier et les exporte en PowerPoint **réellement éditable** ou en PDF.

Application **local-first** : toutes les présentations vivent dans le navigateur (IndexedDB), sans compte, sans serveur, sans abonnement. L’IA est un choix explicite : Ollama en local (gratuit, privé) ou une API externe (Gemini, OpenAI, Mistral, OpenRouter…).

---

## Ce qui fonctionne

### Bibliothèque
- Tableau de bord, reprise des dernières présentations, favoris, brouillons.
- Dossiers et sous-dossiers personnalisables, recherche plein texte (titres **et** contenu des diapositives), filtres par matière et niveau.
- Renommer, dupliquer, déplacer, supprimer avec confirmation, mise en favori.
- Miniatures réelles, rendues depuis la première diapositive.
- Sauvegarde automatique après chaque modification, historique de versions, restauration.
- Export/restauration complète de la bibliothèque (`.zip`, images comprises).

### Création
Trois entrées, un même éditeur :
1. **Un sujet** — l’IA formule une problématique, un plan en 2–3 parties, puis rédige les diapositives.
2. **Des documents** — PDF, DOCX, PPTX, TXT/MD lus dans le navigateur (aucun envoi de fichier). Le prompt impose de ne s’appuyer que sur ces documents et de signaler « [à compléter] » plutôt que d’inventer.
3. **Des notes** — un plan ou un texte libre, réorganisé sans ajout de faits extérieurs.

Paramètres : matière, niveau (6e → Terminale), nombre de diapositives (6–20), profondeur (synthétique / équilibré / approfondi), ton, thème graphique, illustrations libres.

Génération par lots de 3 diapositives, avec progression, annulation et reprise en cas de réponse JSON incomplète. Les illustrations proviennent de **Wikimedia Commons**, filtrées sur les licences réutilisables, avec crédit automatique.

### Éditeur
- Colonne de diapositives avec glisser-déposer, duplication, masquage, suppression.
- Zone centrale à l’échelle, sélection, déplacement, redimensionnement par poignées, repères d’alignement.
- Édition du texte directement dans la diapositive (gras/italique/souligné, alignements, police, taille, couleur, interligne, puces).
- Ajout : texte, image (fichier ou glisser-déposer), formes, tableaux, graphiques, frises, cartes, icônes.
- Panneau de propriétés complet pour chaque type d’élément (données du graphique, événements de la frise, pays et points de la carte, cellules du tableau…).
- Arrière-plans : uni, papier teinté, pointillés, quadrillage, dégradé, image avec voile.
- 6 thèmes appliqués à toute la présentation sans casser la mise en page.
- Annuler/rétablir, raccourcis clavier, notes du professeur, mode présentation plein écran.

### Assistant IA
Panneau conversationnel dans l’éditeur. Il agit sur **une diapositive** ou sur **toute la présentation**, renvoie des modifications structurées et laisse le reste intact :
- « Raccourcis cette diapositive. »
- « Transforme cette partie en frise chronologique. »
- « Ajoute une carte de l’Europe en 1815. » (projection, pays, points)
- « Harmonise le design. »
- « Adapte le vocabulaire à des Troisièmes. »

Chaque modification passe par l’historique : `Ctrl+Z` annule.

### Export
- **PowerPoint `.pptx`** : textes natifs, images, formes, tableaux et graphiques PowerPoint ; cartes, frises et icônes en images haute résolution. Vérification automatique du nombre de diapositives et de la présence de texte natif avant téléchargement.
- **PDF** : une page par diapositive, texte vectoriel, mise en page conservée.
- Fichier `.studio.json` par présentation, pour transférer un cours d’un appareil à l’autre.

---

## Démarrage

```bash
npm install
npm run dev
```

Ouvrir l’URL affichée (par défaut <http://127.0.0.1:5173>). Au premier lancement, Studio crée une bibliothèque de démonstration et quelques dossiers ; tout est supprimable.

Autres commandes :

```bash
npm run build      # vérification TypeScript + build de production
npm run preview    # servir le build
npm run typecheck  # types uniquement
npm run icons      # régénérer les icônes PWA
```

---

## Configurer l’IA

Réglages → Intelligence artificielle. La clé est stockée **uniquement dans ce navigateur** (IndexedDB) et n’est envoyée qu’au fournisseur choisi.

### Google Gemini (le plus simple, offre gratuite)
1. Créer une clé sur <https://aistudio.google.com/apikey>.
2. Choisir « Google Gemini », coller la clé, modèle `gemini-2.5-flash`.
3. « Tester la connexion ».

L’offre gratuite de Google suffit à un usage quotidien raisonnable ; au-delà du quota, Google peut limiter ou facturer. Studio ne promet aucune IA illimitée.

### Ollama (gratuit et privé, à vie)
1. Installer [Ollama](https://ollama.com) et télécharger un modèle : `ollama pull qwen3:8b`.
2. Autoriser l’origine de Studio :
   - Windows : `setx OLLAMA_ORIGINS "*"` puis relancer Ollama.
   - macOS/Linux : `OLLAMA_ORIGINS="*" ollama serve`.
3. Dans Studio : fournisseur « Ollama », URL `http://127.0.0.1:11434`, modèle `qwen3:8b`.

L’ordinateur doit rester allumé. Un modèle 7–8 B suffit pour un diaporama ; les modèles plus gros produisent un français plus sûr.

### Compatible OpenAI
OpenAI, Mistral, OpenRouter, Groq… : renseigner l’URL de base (`https://api.openai.com/v1`, `https://api.mistral.ai/v1`, `https://openrouter.ai/api/v1`), la clé et le modèle. OpenRouter propose des modèles gratuits.

> **Pourquoi pas OpenChamber ?** OpenChamber est l’environnement dans lequel Studio a été développé ; il n’expose pas d’API de génération que l’application pourrait appeler depuis un iPad. Studio a donc besoin d’un point d’accès modèle : Ollama ou une clé API.

---

## Architecture

```
src/
  lib/
    model.ts           modèle de document (diapositives, éléments, styles)
    themes.ts          6 thèmes, polices compatibles Office
    layouts.ts         moteur de mise en page : contenu structuré → éléments éditables
    store.ts           état applicatif, historique, sauvegarde automatique
    db.ts              IndexedDB (présentations, images, versions, dossiers, réglages)
    svg.ts             cartes (d3-geo + Natural Earth), frises, graphiques, icônes
    ai/
      providers.ts     Gemini / Ollama / compatible OpenAI, erreurs explicites
      prompts.ts       consignes pédagogiques et contrat JSON
      generate.ts      plan → lots de diapositives → illustrations → mise en page
      assistant.ts     modifications ciblées, jamais destructives
    documents/         extraction PDF, DOCX, PPTX, texte
    export/            PPTX natif (pptxgenjs), PDF (pdf-lib)
  components/
    library/           tableau de bord, bibliothèque, cartes
    wizard/            création guidée
    editor/            éditeur, canevas, inspecteur, assistant, présentation
    slide/             rendu partagé écran / miniature / export
```

**Principe clé** : l’IA ne produit jamais de positions ni de HTML. Elle renvoie un contenu structuré (`bullets`, `timeline`, `map`, `chart`, `table`, `document`…) ; `layouts.ts` le transforme en éléments positionnés et stylés. Résultat : une mise en page cohérente, et un document **réellement éditable**.

Les cartes utilisent les données **Natural Earth** (domaine public) via `world-atlas`, projetées avec `d3-geo`. Les pays sont mis en avant par leur nom anglais ; les points par longitude/latitude.

### Données et vie privée
- Présentations, images et versions : IndexedDB local, jamais envoyés.
- Aucun compte, aucun traceur, aucune requête vers un serveur Studio.
- Seuls le fournisseur IA choisi et Wikimedia Commons (illustrations) reçoivent des requêtes.
- Sauvegarde conseillée : Réglages → « Exporter la bibliothèque (.zip) ».

### Limites assumées
- **Pas de synchronisation cloud automatique.** Le transfert entre appareils se fait par la sauvegarde `.zip` ou le fichier `.studio.json`. C’est le prix de l’absence de serveur et d’abonnement ; le README décrit cette limite sans la masquer.
- **PDF scannés sans couche texte** : non lus (pas d’OCR). Studio le signale au dépôt du fichier.
- **Cartes** : fonds Natural Earth modernes. Les cartes historiques (frontières de 1815, par exemple) relèvent de la recherche d’image ou d’un fond fourni ; l’IA ne dessine pas de frontières historiques inventées.
- **Images** : Wikimedia Commons uniquement, avec crédit. Pas de génération d’images.
- **Fidélité PPTX** : les cartes, frises et icônes sont des images ; textes, tableaux, graphiques et formes restent natifs.
- **Clé API** : stockée dans le navigateur. Sur un appareil partagé, ne pas enregistrer de clé.

---

## Déploiement

Le build est 100 % statique (routing par ancre), donc hébergeable partout : GitHub Pages, Netlify, Cloudflare Pages, un simple dossier.

### GitHub Pages
Le workflow `.github/workflows/deploy.yml` construit et publie à chaque push sur `main`.

1. Créer un dépôt **sur le compte GitHub dédié** (pas le compte habituel).
2. Pousser le projet sur `main`.
3. Dans *Settings → Pages*, choisir **GitHub Actions** comme source.
4. L’URL est `https://<compte>.github.io/<dépôt>/`.

Aucune variable d’environnement n’est nécessaire : les clés IA sont saisies par l’utilisateur dans l’application.

### Hébergement alternatif
`npm run build` puis publier `dist/`. Configurer une réécriture vers `index.html` n’est pas nécessaire (hash routing).

---

## Tests

Les scripts Playwright couvrent les parcours critiques :

```bash
npm run dev            # dans un terminal
node scripts/e2e.mjs     # capture, édition, exports PPTX/PDF, iPad, téléphone
node scripts/interact.mjs # édition de texte, déplacement, annulation, persistance, thème, présentation
```

Ils vérifient notamment :
- la création et l’ouverture d’une présentation ;
- l’édition d’un texte et sa persistance après rechargement ;
- le déplacement d’un élément et l’annulation ;
- l’ajout d’une diapositive et le mode présentation ;
- l’export PPTX (nombre de diapositives, texte natif, image de carte) et PDF (nombre de pages).

Les captures sont écrites dans `shots/` (ignoré par Git).

---

## Licence

Projet privé — tous droits réservés. Les données Natural Earth sont du domaine public ; les icônes Lucide sont sous licence ISC ; les polices utilisées sont celles du système (aucune police embarquée).
