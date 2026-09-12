# Dernier print

Simulateur de tirage en aluminium. Site ultra-épuré, noir et blanc strict,
esthétique rétro années 90.

## Parcours

1. **Accueil** — titre « Dernier print » et un seul bouton, « Je simule un
   print », qui ouvre le sélecteur de fichier (JPG, JPEG, PNG, WEBP, AVIF,
   GIF, BMP, TIFF).
2. **Analyse** — pop-up rétro (barre de progression hachurée, étapes en
   `[x]`, curseur clignotant) pendant que le fichier est inspecté :
   ratio, nombre de pixels et DPI.
3. **Configuration** — double colonne : aperçu à gauche, produit et
   configurateur à droite, prix et bouton « Commander » en bas à droite.

## Règles produit

- **Ratio** conservé : le slider pilote le grand côté, le petit côté est
  déduit du ratio d'origine.
- **Plage** : 15×15 cm minimum, 120×240 cm maximum (petit côté plafonné à
  120 cm, grand côté à 240 cm).
- **Pas** : 1 cm, dimensions entières uniquement.
- **Prix** : surface en m² × 754,80 € TTC, recalculé en temps réel.

Les bornes et le calcul de prix vivent dans [`src/print.js`](src/print.js)
et sont couverts par les tests.

## Extraction du DPI

[`src/imageMeta.js`](src/imageMeta.js) lit le DPI réellement inscrit dans le
fichier, sans dépendance externe :

| Format | Source |
| --- | --- |
| JPEG | segment APP0/JFIF (densité) ou APP1/Exif (`XResolution`) |
| PNG | chunk `pHYs` (pixels par mètre) |
| WEBP | chunk RIFF `EXIF` |

Faute de métadonnée, on retombe sur 72 DPI, signalé « par défaut » dans
l'interface. La fiche technique affiche aussi le DPI effectif au format
d'impression choisi.

## Typographie

Monument Grotesk est une fonte commerciale (Dinamo) : les fichiers ne sont
pas versionnés. Voir [`public/fonts/README.md`](public/fonts/README.md) pour
l'activer ; sans eux, la pile de repli (Neue Haas Grotesk / Helvetica Neue /
Arial) prend le relais.

## Développement

```bash
npm install
npm start        # http://localhost:3000
npm test         # tests unitaires et de rendu
npm run build    # bundle de production dans build/
```

## Reste à faire

Le bouton « Commander » affiche le récapitulatif de la commande ; le
paiement n'est pas branché. Les dépendances Stripe sont présentes dans
`package.json` mais aucun tunnel de paiement n'est encore câblé — il devra
passer par un backend, la clé secrète ne devant jamais vivre côté client.
