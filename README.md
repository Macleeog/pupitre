# Pupitre

**Fan site. Pupitre n’est pas lié à Ankama.**

Dofus, Dofus Touch et Ankama sont des marques d’Ankama. Ce projet n’est pas approuvé, affilié ni soutenu par Ankama. Aucun logo, personnage ou visuel officiel n’est utilisé. C’est un outil de fans, rien d’autre.
This is a fan site, not an Ankama product. Dofus and Ankama are trademarks of Ankama.

Second écran pour Dofus 3 : ordre de passage, roue des personnages, textes à coller dans le chat et compteur de farm. Le front est en React (TanStack Start). Il n’y a pas de backend Rust : le bureau est un exécutable Electron, et les données restent sur la machine.

Inspiré du pupitre [Multifus](https://github.com/viclafouch/multifus) (Dofus Rétro), réécrit pour le client Unity. 

## Pour commencer

Il faut Windows 10 ou 11, 64 bits. Rien d’autre : pas de Node, pas de compte Pupitre, pas de droit administrateur. Dofus n’a pas besoin d’être ouvert, sauf pour le bandeau qui suit la fenêtre du jeu. Internet sert au téléchargement et à la recherche d’objets (DofusDB). Le reste reste sur la machine.

1. Télécharge [Pupitre pour Windows (zip)](https://github.com/Macleeog/pupitre/releases/latest) (environ 100 Mo).
2. Si Chrome affiche « Opening when complete » à 100/100 Mo, le téléchargement est fini. Ferme la bulle. N’ouvre pas le fichier depuis Chrome.
3. Extrais le zip, puis double-clique sur `Pupitre.exe` dans le dossier. Si SmartScreen bloque : **Informations complémentaires**, puis **Exécuter quand même**. L’exe n’est pas signé.

Dans l’exe, le bandeau de session suit la fenêtre Dofus au premier plan (ou la première ouverte) et ne s’affiche que quand Dofus est devant. Glisse-le où tu veux : sa place par rapport à la fenêtre du jeu est retenue.

| Touche | Action |
|---|---|
| Ctrl+Maj+F6 | Démarrer la session |
| Ctrl+Maj+F7 | Pause |
| Ctrl+Maj+F8 | Terminer |
| Ctrl+Maj+F5 | +1 combat |

## Lecture du réseau (onglet Réseau)

Optionnel. Avec [Wireshark](https://www.wireshark.org/download.html) installé (garde Npcap coché), l'exe lit en lecture seule les messages du jeu, ceux dont le type commence par `type.ankama.com/`. Il ne modifie ni la connexion ni le fichier `hosts`, et n'envoie rien.

- **Combats** : début, tours et fin de combat sont détectés. La session de farm peut compter +1 combat toute seule (une fois par combat, même en multicompte).
- **Butin** : à la fin du combat, les kamas et les objets de tes personnages vont dans les ressources de la session. Pupitre reconnaît un personnage quand il lance un sort ou passe son tour depuis ce PC. Avant ça, il crédite seulement un gagnant unique (combat solo) ; à plusieurs, il affiche « butin non attribué » et n'ajoute rien. Les lignes venues d'un combat portent le badge « combat », restent modifiables, et « Butin des derniers combats » permet d'annuler un combat (kamas et objets, pas le compteur de combats).
- **Capturer les paquets** : enregistre chaque message décodé dans `%APPDATA%\Pupitre\packet-captures\capture-….ndjson`, une ligne JSON par message.

Les codes des messages de combat (`desktop/game-net/fights.cjs`) viennent de Blitzkrieg 1.42 (licence MIT). Ankama les renomme aux mises à jour : une capture permet de retrouver les nouveaux.

Les conditions d'utilisation d'Ankama interdisent les logiciels tiers qui lisent le trafic du jeu. À tes risques pour ton compte.

## Développement

```bash
npm install
npm run dev
```

Le `.exe` est construit par GitHub Actions à chaque étiquette `v*`. `npx electron-builder --win portable` doit tourner sous Windows.
