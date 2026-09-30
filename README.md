# Pupitre

**Fan site. Pupitre n’est pas lié à Ankama.**

Dofus, Dofus Touch et Ankama sont des marques d’Ankama. Ce projet n’est pas approuvé, affilié ni soutenu par Ankama. Les symboles et illustrations des classes (`public/classes/`) sont la propriété d’Ankama ; ils viennent de l’encyclopédie officielle et de DofusDB, et servent seulement à reconnaître les classes, sans usage commercial. C’est un outil de fans, rien d’autre.
This is a fan site, not an Ankama product. Dofus and Ankama are trademarks of Ankama.

Second écran pour Dofus 3 (monocompte) : ton personnage, un compteur de farm avec lecture réseau des combats, un bandeau sur la fenêtre du jeu, un historique avec export Excel, et des raccourcis globaux. Le front est en React (TanStack Start). Il n’y a pas de backend Rust : le bureau est un exécutable Electron, et les données restent sur la machine.

Inspiré du pupitre [Multifus](https://github.com/viclafouch/multifus) (Dofus Rétro), réécrit pour le client Unity. 

## Pour commencer

Il faut Windows 10 ou 11, 64 bits. Rien d’autre : pas de Node, pas de compte Pupitre, pas de droit administrateur. Dofus n’a pas besoin d’être ouvert, sauf pour le bandeau qui suit la fenêtre du jeu. Internet sert au téléchargement et à la recherche d’objets (DofusDB). Le reste reste sur la machine.

1. Télécharge `Pupitre-Setup-….exe` depuis les [versions](https://github.com/Macleeog/pupitre/releases/latest).
2. Ouvre-le depuis le dossier Téléchargements. Si SmartScreen bloque : **Informations complémentaires**, puis **Exécuter quand même**. L’exe n’est pas signé.
3. Il s’installe pour ton compte Windows, sans droit administrateur, avec un raccourci sur le Bureau et dans le menu Démarrer.

Ensuite, Pupitre se met à jour tout seul : il cherche une nouvelle version au lancement puis toutes les 4 heures, la télécharge, et l’installe au redémarrage (bouton **Redémarrer**, ou à la prochaine fermeture). Une version de test (beta) reçoit aussi les betas suivantes. Les anciennes versions en zip ne se mettent pas à jour : installe le Setup une fois, tes sessions et réglages sont repris.

Dans l’exe, le bandeau de session suit la fenêtre Dofus au premier plan (ou la première ouverte) et ne s’affiche que quand Dofus est devant. Glisse-le pour le poser où tu veux sur la fenêtre du jeu : sa place est retenue, et il garde sa taille. Dans **Réglages**, choisis sa taille (petit 300 × 150 ou grand 380 × 210), son opacité (de transparent à opaque) et les infos affichées (kamas/heure, valeur gagnée, kamas des combats, objets, combats, donjons) et les boutons.

Raccourcis par défaut, modifiables dans l'onglet **Réglages** (bouton Modifier, puis la combinaison ; Échap annule) :

| Touche | Action |
|---|---|
| Ctrl+Maj+F9 | Afficher / masquer le bandeau |
| Ctrl+Maj+F6 | Démarrer la session |
| Ctrl+Maj+F7 | Pause |
| Ctrl+Maj+F8 | Terminer |
| Ctrl+Maj+F10 | Remettre la session à zéro, sans l'historique |
| Ctrl+Maj+F5 | +1 combat |

Si une combinaison est déjà prise par une autre application, l'onglet le signale. Les raccourcis sont aussi gardés dans `%APPDATA%\Pupitre\shortcuts.json`, pour marcher dès le lancement.

## Lecture du réseau (onglet Réseau)

Optionnel. Avec [Wireshark](https://www.wireshark.org/download.html) installé (garde Npcap coché), l'exe lit en lecture seule les messages du jeu, ceux dont le type commence par `type.ankama.com/`. Il ne modifie ni la connexion ni le fichier `hosts`, et n'envoie rien. La lecture ne tourne que pendant une session, ou tant que l'onglet Réseau est ouvert, et seulement sur les vraies cartes réseau. La version de Pupitre est affichée dans l'en-tête et en bas de page.

- **Combats** : début, tours et fin de combat sont détectés. La session de farm peut compter +1 combat toute seule (une fois par combat, même en multicompte).
- **Butin** : à la fin du combat, les kamas et les objets de tes personnages vont dans les ressources de la session. Pupitre reconnaît un personnage quand il lance un sort ou passe son tour depuis ce PC, et s'en souvient d'une fois sur l'autre (`%APPDATA%\Pupitre\own-fighters.json`, bouton **Oublier** dans Réseau). Avant ça, il crédite seulement un gagnant unique (combat solo) ; à plusieurs, il affiche « butin non attribué » et n'ajoute rien. Les lignes venues d'un combat portent le badge « combat », restent modifiables, et « Butin des derniers combats » permet d'annuler un combat (kamas et objets, pas le compteur de combats).
- **Prix de l'hôtel des ventes** : Pupitre lit les prix que l'HDV t'affiche, en mode vente (tes objets en vente) comme en mode achat (le prix du marché quand tu cliques un objet). Il garde le lot le moins cher par unité (lots de 1, 10 ou 100) et l'applique aux ressources de la session, badge « HDV ». Un prix tapé à la main n'est jamais remplacé. Liste et bouton **Oublier** dans Réseau. Les deux messages décodés (`desktop/game-net/market.cjs`) viennent de captures du 29/09/2026, pas de Blitzkrieg.
- **Avis de recherche et archimonstres** : en arrivant sur une carte, Pupitre reconnaît les monstres des groupes. Si l'un d'eux est un avis de recherche ou un archimonstre, une petite carte s'affiche (image du monstre, nom en haut à droite, coordonnées et `/travel`). Un archimonstre est mis en surbrillance, avec le Dofus ocre devant son nom. Glisse-la : sa place est retenue. Elle disparaît au bout de 10 secondes, ou si tu cliques la croix. Le bandeau le rappelle encore un moment, et l'onglet Réseau garde la commande. Les deux listes viennent de DofusDB (quêtes « avis de recherche » pour l'une, `isMiniBoss` pour l'autre). Chaque alerte se coupe séparément dans Réglages.
- **Capturer les paquets** : enregistre chaque message décodé dans `%APPDATA%\Pupitre\packet-captures\capture-….ndjson`, une ligne JSON par message.

Les codes des messages de combat (`desktop/game-net/fights.cjs`) viennent de Blitzkrieg 1.42 (licence MIT). Ankama les renomme aux mises à jour : quand la plupart des types reçus sont inconnus (`desktop/game-net/known-types.cjs`), l'onglet Réseau affiche une alerte. Une capture pendant un combat permet de retrouver les nouveaux codes. La marche à suivre est dans [docs/mise-a-jour-dofus.md](docs/mise-a-jour-dofus.md).

Les conditions d'utilisation d'Ankama interdisent les logiciels tiers qui lisent le trafic du jeu. À tes risques pour ton compte.

Le détail de chaque fonction, des fichiers, et la marche à suivre après une mise à jour de Dofus (paquets, bandeau, icône) sont dans [docs/guide-technique.md](docs/guide-technique.md).

## Développement

```bash
npm install
npm run dev
```

Le `.exe` est construit par GitHub Actions à chaque étiquette `v*`. `npx electron-builder --win portable` doit tourner sous Windows.
