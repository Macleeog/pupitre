# Pupitre

Second écran pour Dofus 3 : ordre de passage, roue des personnages, textes à coller dans le chat et compteur de farm.

Ce n’est pas le client de jeu. Pupitre ne lit pas la mémoire de Dofus et n’envoie rien au serveur. Indépendant d’Ankama. Dofus est une marque d’Ankama.

Inspiré du pupitre [Multifus](https://github.com/viclafouch/multifus) (Dofus Rétro), réécrit pour le client Unity.

## Pour commencer

Il faut Windows 10 ou 11, 64 bits. Rien d’autre : pas de Node, pas de compte Pupitre, pas de droit administrateur. Dofus n’a pas besoin d’être ouvert, sauf pour le bandeau qui suit la fenêtre du jeu. Internet sert au téléchargement et à la recherche d’objets (DofusDB). Le reste reste sur la machine.

1. Télécharge [Pupitre.exe](https://github.com/Macleeog/pupitre/releases/latest) (environ 100 Mo). Le fichier s’appelle `Pupitre.x.y.z.exe`.
2. Si Windows SmartScreen bloque le lancement, choisis **Informations complémentaires**, puis **Exécuter quand même**. L’exe n’est pas signé.
3. Double-clic. La fenêtre s’ouvre toute seule.

Dans l’exe, le bandeau de session suit la première fenêtre dont le titre contient Dofus.

| Touche | Action |
|---|---|
| Ctrl+Maj+F6 | Démarrer la session |
| Ctrl+Maj+F7 | Pause |
| Ctrl+Maj+F8 | Terminer |
| Ctrl+Maj+F5 | +1 combat |

## Développement

```bash
npm install
npm run dev
```

Le `.exe` est construit par GitHub Actions à chaque étiquette `v*`. `npx electron-builder --win portable` doit tourner sous Windows.
