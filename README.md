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

Dans l’exe, le bandeau de session suit la fenêtre Dofus au premier plan (ou la première ouverte) et ne s’affiche que quand Dofus est devant. Glisse-le où tu veux : sa place par rapport à la fenêtre du jeu est retenue, et il garde sa taille. Dans **Réglages**, choisis sa taille (petit 300 × 150 ou grand 380 × 210), les infos affichées (kamas/heure, valeur gagnée, kamas des combats, objets, combats, donjons) et les boutons.

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
- **Capturer les paquets** : enregistre chaque message décodé dans `%APPDATA%\Pupitre\packet-captures\capture-….ndjson`, une ligne JSON par message.

Les codes des messages de combat (`desktop/game-net/fights.cjs`) viennent de Blitzkrieg 1.42 (licence MIT). Ankama les renomme aux mises à jour : quand la plupart des types reçus sont inconnus (`desktop/game-net/known-types.cjs`), l'onglet Réseau affiche une alerte. Une capture pendant un combat permet de retrouver les nouveaux codes.

Les conditions d'utilisation d'Ankama interdisent les logiciels tiers qui lisent le trafic du jeu. À tes risques pour ton compte.

## Guides de quêtes

L'onglet **Quêtes** suit les guides (Dofus, secondaires, alignements, événements). Cocher une quête avance la barre du guide. Le texte de suivi est celui qu'on lit en jeu ; une position comme `[8,3]` copie `/travel 8,3` (sans espace en trop, les coordonnées négatives passent). Sur un autre monde, Pupitre ne propose pas `/travel`.

Les récompenses affichées sont les kamas des quêtes et des succès déjà connus. Pupitre n'invente pas d'expérience absolue.

Données issues de DofusDB. Utilisation soumise à la LPNC-IA 1.0.

## Veille : archimonstres, avis de recherche, Comte Harebourg

Deux réglages séparés : **Archimonstres** et **Avis de recherche**. Quand l'un est sur la carte, ou qu'un message du chat donne sa position, une carte avec le portrait s'affiche. Sur le monde principal, le bouton copie `/travel x,y`. Ailleurs, pas de commande.

Le **Comte Harebourg** (monstre 3416) est suivi pendant le combat. Pupitre reconnaît le personnage depuis la fenêtre Dofus ouverte : aucun nom ni classe n'est écrit en dur. Le panneau dit pour qui il calcule. La case verte est dessinée sur la fenêtre du jeu, seulement quand ce personnage et ses points de vie sont connus. Sinon, aucune case. Survoler un allié montre sa rotation dans le panneau, sans déplacer la marque. Les flèches calent l'origine et l'échelle une fois, pour tout le monde.

La lecture réseau reste allumée tant que la veille ou les alertes sont activées. Elle ne fait qu'écouter.

## Développement

```bash
npm install
npm run dev
```

Le `.exe` est construit par GitHub Actions à chaque étiquette `v*`. `npx electron-builder --win portable` doit tourner sous Windows.
