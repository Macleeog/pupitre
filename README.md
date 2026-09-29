# Pupitre

Second écran pour Dofus 3 : ordre de passage, roue des personnages, textes à coller dans le chat et compteur de farm.

Ce n’est pas le client de jeu. Pupitre ne lit pas la mémoire de Dofus et ne passe pas une fenêtre au premier plan. Indépendant d’Ankama. Dofus est une marque d’Ankama.

Inspiré du pupitre [Multifus](https://github.com/viclafouch/multifus) (Dofus Rétro), réécrit pour le client Unity.

## Site

```bash
npm install
npm run dev
```

## Windows (.exe)

Le fichier `Pupitre.exe` est construit par GitHub Actions sur une étiquette `v*`.

```bash
npm run desktop:build
npx electron-builder --win portable
```

La seconde commande doit tourner sous Windows. L’exécutable ouvre Pupitre dans sa propre fenêtre, en local.
