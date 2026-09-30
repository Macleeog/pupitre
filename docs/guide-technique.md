# Guide technique de Pupitre

Ce document décrit le dépôt tel qu'il est, fonction par fonction, puis ce qu'il faut toucher quand Dofus change ou quand on veut modifier le bandeau, l'icône ou une alerte. Il s'adresse à quelqu'un qui ouvre le code.

Pupitre est un outil de fan pour Dofus 3, en monocompte. Il n'est pas lié à Ankama. Il ne se connecte pas au jeu, n'écrit rien sur la connexion, et ne modifie pas le fichier `hosts`. La lecture réseau, quand elle est allumée, ne fait que copier des messages déjà présents sur le réseau.

Les conditions d'utilisation d'Ankama interdisent les logiciels tiers qui lisent le trafic du jeu. Réparer la lecture se fait à tes risques pour le compte.

La date de référence des noms de messages (`jwe`, `ket`, `jpo`, …) est le **29 septembre 2026**. Ces noms sont ceux du client de cette date. Une mise à jour d'Ankama les renomme en général tous ensemble.

---

## 1. Deux programmes, un dépôt

| Programme | À quoi il sert | Comment il démarre |
|---|---|---|
| Le bureau Windows | L'application que tu ouvres pour jouer. Electron, une fenêtre, le bandeau, la lecture réseau. | `desktop/main.cjs`, empaqueté par `electron-builder` |
| L'aperçu web | Le même écran, servi pour le développement. Pas de lecture réseau : le navigateur ne peut pas écouter la connexion du jeu. | `npm run dev` |

Le front est le même dans les deux cas : React, TanStack Router, un magasin Zustand. Les routes utiles sont :

| Route | Fichier | Rôle |
|---|---|---|
| `/` | `src/routes/index.tsx` | Le bureau : Session, Réseau, Réglages |
| `/overlay` | `src/routes/overlay.tsx` | Le bandeau, dans sa propre fenêtre |
| `/avis` | `src/routes/avis.tsx` | La petite carte d'alerte (avis de recherche ou archimonstre) |

Le bureau ne fait aucun appel serveur pour ces écrans. Personnage, session, historique et réglages restent sur la machine.

---

## 2. Carte du dépôt

Garde ce tableau sous les yeux avant de supprimer un dossier. Une grande partie de `src/lib` ne sert pas à Pupitre : c'est le socle de l'aperçu web (compte, base, connecteurs). Le retirer casse la construction, pas le jeu.

| Chemin | Rôle pour Pupitre | Y toucher pour… |
|---|---|---|
| `desktop/main.cjs` | Processus Electron : fenêtres, bandeau, carte d'alerte, raccourcis, arrêt | Le comportement des fenêtres |
| `desktop/preload.cjs` | Le pont `window.pupitre` entre la page et Electron. Isolation activée, pas de Node dans la page | Ajouter une action que la page doit demander au processus |
| `desktop/static.cjs` | Sert les pages construites, en local, dans le processus Electron | L'ouverture de l'application |
| `desktop/follow-dofus.ps1` | Script Windows qui lit la position de la fenêtre Dofus | Le suivi du bandeau |
| `desktop/updates.cjs` | Mise à jour automatique depuis les versions GitHub | Le rythme ou le canal de mise à jour |
| `desktop/icon.png` | Icône de la fenêtre quand on lance Electron sans installateur | L'icône à l'écran |
| `desktop/game-net/` | Décodage des messages du jeu | Une mise à jour de Dofus |
| `src/components/pupitre/` | Tous les écrans | Le texte, la disposition, le bandeau, la carte |
| `src/lib/pupitre/` | Règles de la session, de l'historique, des raccourcis, du bandeau | Un calcul (kamas/heure, export, opacité) |
| `src/lib/pupitre/store.ts` | État enregistré dans le navigateur intégré, clé `pupitre-dofus3` | Un réglage qui doit survivre à la fermeture |
| `src/pupitre-desktop.d.ts` | Forme de `window.pupitre` | Un nouveau canal entre la page et Electron |
| `public/classes/` | Portraits des classes. Propriété d'Ankama, créditée dans le README | Changer une image de classe |
| `public/favicon.svg` | Icône de l'onglet dans l'aperçu web | L'onglet du navigateur, pas l'exe |
| `build/icon.svg` | Dessin source de l'icône Windows | Changer l'icône de l'application |
| `build/icon.ico` | Icône gravée dans l'installeur et l'exe | Produit par `scripts/make-icon.mjs`, ne pas le dessiner à la main |
| `scripts/game-net.test.mjs` | Tests des combats, de l'HDV, des avis, des coordonnées | Après chaque changement de code réseau |
| `scripts/static-server.test.mjs` | Tests du serveur de pages local | Après un changement de `desktop/static.cjs` |
| `.github/workflows/windows-exe.yml` | Construit `Pupitre-Setup-….exe` à chaque étiquette `v*` | La publication |
| `docs/mise-a-jour-dofus.md` | Procédure courte, limitée aux paquets | Le cas « Dofus a changé ses codes » |
| `src/lib/auth/`, `src/lib/db.ts`, `src/lib/app-data/` | Socle d'aperçu. Pupitre ne s'en sert pas | Ne pas les brancher sur une session de farm |
| `public/__grok/`, `server/` | Chrome de l'aperçu web | Ne pas les retirer : la construction web en a besoin |

`package.json` a deux rôles. Le champ `"version"` est le numéro affiché et le nom de l'installeur. Le bloc `"build"` est la recette electron-builder : icône, langues gardées (`en-US` et `fr`), et le dossier de pages copié dans l'exe (`extraResources` depuis `.output/public`).

---

## 3. Ce qui se passe à l'ouverture

1. Electron démarre `desktop/main.cjs`.
2. Le processus sert les pages déjà construites (`desktop/static.cjs`), depuis `.output/public` en développement, ou depuis le dossier `output` embarqué une fois installé. La coque s'appelle `_shell.html` : `/`, `/overlay` et `/avis` retombent dessus. Il n'y a pas de second programme Node à attendre.
3. Deux fenêtres se créent. Le bureau (`/`) s'affiche. Le bandeau (`/overlay`) reste caché tant que Dofus n'est pas devant.
4. La lecture réseau ne démarre que si une session tourne, si l'onglet Réseau est ouvert, ou si une alerte de carte est cochée.
5. Huit secondes après l'ouverture, puis toutes les quatre heures, une copie installée par le Setup cherche une nouvelle version (`desktop/updates.cjs`). Une copie lancée depuis le code source ne se met pas à jour.

Les versions publiées jusqu'à **0.1.15** inclus faisaient autrement : elles lançaient un serveur Node complet (Nitro) et n'affichaient la fenêtre qu'une fois ce serveur prêt. Ce serveur, plus toutes les langues de Chromium, expliquent une installation d'environ 500 Mo et une ouverture longue. Le code actuel ne copie plus que les pages, et ne garde que le français et l'anglais dans l'exe. Le poids qui reste est celui d'Electron lui-même (le moteur d'affichage), de l'ordre de 250 Mo une fois installé. On ne descend pas en dessous sans changer de moteur.

La construction des pages pour l'exe passe par `npm run desktop:build`, qui pose `PUPITRE_DESKTOP=1`. Dans ce mode le routeur est un site d'une seule coque HTML : la page gère `/`, `/overlay` et `/avis`. Nitro reste sur le preset `node-server` le temps d'écrire cette coque. Le preset `static` casse la construction : il ne sait pas empaqueter `scripts/install-page.html?raw`, dont l'aperçu web a besoin. On ne change pas ce preset pour « alléger » la construction. L'installeur, lui, ne copie que `.output/public` (`extraResources` dans `package.json`). Le dossier `.output/server` produit à côté n'entre pas dans l'exe. La construction web ordinaire (`npm run build` sans `PUPITRE_DESKTOP`) continue de viser l'hébergement de l'aperçu.

---

## 4. Où sont les données sur le PC

Rien de tout cela n'est dans le dépôt. Tout est sous `%APPDATA%\Pupitre\`.

| Fichier ou clé | Contenu | Qui l'écrit |
|---|---|---|
| Clé `pupitre-dofus3` (stockage de la page) | Personnage, session en cours, historique, prix d'HDV retenus, cases du bandeau, taille, opacité, boutons, raccourcis affichés, cases d'alertes | `src/lib/pupitre/store.ts` |
| `overlay.json` | Coin du bandeau (`right`, `top`) et sa taille | `desktop/main.cjs` |
| `toast.json` | Position de la carte d'alerte (`x`, `y`) | `desktop/main.cjs` |
| `shortcuts.json` | Raccourcis réellement enregistrés auprès de Windows | `desktop/main.cjs` |
| `own-fighters.json` | Identifiants des personnages reconnus sur ce PC | `desktop/game-net/reader.cjs` |
| `game-servers.json` | Adresses des serveurs de jeu, gardées 12 heures | `desktop/game-net/reader.cjs` |
| `map-coords.json` | Cache `id de carte → {x, y}` | `desktop/game-net/map-coords.cjs` |
| `packet-captures\capture-….ndjson` | Messages décodés. Contient l'identifiant du personnage et le chat | Bouton **Capturer les paquets** |

Effacer le dossier `%APPDATA%\Pupitre` remet Pupitre à zéro sans désinstaller. Ne commite jamais une capture : elle identifie le compte.

La clé `pupitre-dofus3` et les fichiers JSON ne sont pas la même chose. Changer la taille du bandeau dans Réglages met à jour la clé. Déplacer le bandeau à la souris met à jour `overlay.json`. Les deux doivent rester d'accord : la page lit la taille, le processus Windows lit le coin.

---

## 5. Les fonctions, une par une

### 5.1 Personnage

Écran : `src/components/pupitre/character-view.tsx`.

Un seul personnage (`me` dans le magasin) : un nom et une classe. Les dix-neuf classes sont dans `src/lib/pupitre/classes.ts` (`CLASS_IDS`, nom français, un mot d'indice). Le portrait vient de `public/classes/<id>.jpg`. Les illustrations sont celles d'Ankama ; le README le dit.

Pour ajouter ou renommer une classe : l'id dans `CLASS_IDS`, une ligne dans `CLASSES`, et un fichier `public/classes/<id>.jpg`. L'id est aussi la clé enregistrée chez l'utilisateur. Le changer casse le personnage déjà choisi.

Avant la 0.1.12 le bureau gardait une équipe. À l'ouverture, l'ancien personnage de devant devient `me` (`merge` dans `store.ts`). Ne retire pas ce raccord.

### 5.2 Session de farm

Écran : `src/components/pupitre/farm-view.tsx`. Calculs : `src/lib/pupitre/farm.ts`.

Une session a un état (`idle`, `running`, `paused`, `done`), une zone, des notes, un chronomètre, un compteur de combats, un compteur de donjons, des dépenses (clefs, autres) et un jackpot. Les ressources sont des lignes : nom, quantité, prix unitaire, origine du prix (`manuel` ou `hdv`).

Le total suit la formule du code : valeur des ressources + kamas de combat + jackpot − clefs − autres dépenses. Les kamas par heure portent sur la valeur « normale » (hors jackpot) divisée par le temps écoulé, pauses retirées.

Actions de la page, aussi déclenchables par raccourci : démarrer, pause, terminer, remettre à zéro, +1 combat, +1 donjon. **Terminer** range un résumé dans l'historique. **Remettre à zéro** vide la session sans toucher à l'historique.

Deux cases dans l'onglet Réseau pilotent l'automatique :

- `autoCombats` : +1 combat à chaque fin de combat détectée, une fois par combat.
- `autoLoot` : ajoute les kamas et les objets du personnage reconnu. Un prix saisi à la main n'est jamais écrasé par l'HDV.

Les dix derniers butins de combat restent annulables (kamas et objets, pas le compteur de combats).

### 5.3 Historique et export

Écran : `src/components/pupitre/history-view.tsx`. Fichier : `src/lib/pupitre/history.ts`.

L'historique est la liste `farmHistory` dans la clé `pupitre-dofus3`. On peut retirer une ligne. L'export est un CSV pour Excel français : BOM UTF-8, séparateur point-virgule, dates `jj/mm/aaaa hh:mm`. Une cellule qui commencerait par `=`, `+`, `-` ou `@` est préfixée pour ne pas devenir une formule.

Le taux par zone est la somme des valeurs divisée par la somme des durées, pas la moyenne des taux. Une longue session pèse plus qu'une courte.

### 5.4 Recherche d'objets

Fichier : `src/lib/pupitre/items.ts`.

À partir de deux lettres, la page interroge `https://api.dofusdb.fr/items` (paramètre `slug.fr[$search]`, langue `fr`, huit résultats). Ce n'est pas un paquet du jeu. Une mise à jour de Dofus ne casse cette recherche que si DofusDB change d'adresse ou de forme. Le prix proposé à la sélection est celui du catalogue, pas celui de l'HDV lu en jeu.

### 5.5 Bandeau

Page : `src/components/pupitre/overlay.tsx`. Chiffres affichés : `src/lib/pupitre/overlay.ts`. Réglages : `OverlayCard` dans `src/components/pupitre/settings-view.tsx`. Fenêtre : `desktop/main.cjs`. Suivi : `desktop/follow-dofus.ps1`.

Le bandeau est une fenêtre sans cadre, toujours au-dessus, absente de la barre des tâches. Il ne s'affiche que lorsque Dofus est au premier plan (ou lorsque la carte d'alerte est ouverte, pour ne pas disparaître au clic sur la croix).

| Réglage | Valeurs | Où c'est stocké | Où c'est codé |
|---|---|---|---|
| Taille | Petit 300 × 150, grand 380 × 210 | Clé `pupitre-dofus3` (`overlaySize`) et `overlay.json` (`size`) | `OVERLAY_SIZES` dans `main.cjs` |
| Opacité | 20 % à 100 %, défaut 80 %. Porte sur le fond de la carte seulement | Clé `pupitre-dofus3` (`overlayOpacity`) | `clampOverlayOpacity` dans `store.ts`, fond `rgba(26, 18, 12, α)` dans `overlay.tsx` |
| Infos | Kamas/heure, valeur gagnée, kamas des combats, objets, combats, donjons. Défaut : kamas/heure et combats | `overlayFields` | `OVERLAY_FIELDS` dans `store.ts` |
| Boutons | Start, Pause, Stop, +1 | `overlayButtons` | La page du bandeau |
| Position | Coin haut-droit par défaut (`right: 12`, `top: 48`), sinon l'endroit lâché | `overlay.json` | `loadPlacement` dans `main.cjs` |

Combien de lignes tiennent : le petit bandeau avec boutons affiche 3 infos, sinon 6. Le grand en affiche 6. C'est `overlayCapacity`.

Détails qui ont déjà cassé le déplacement sous Windows, et qu'il ne faut pas « simplifier » :

- La fenêtre est `focusable: true`. Une fenêtre non focalisable ne reçoit pas la souris.
- `transparent: true` et un fond `#00000000` sont posés à la création. On ne peut pas les ajouter après. L'opacité n'est pas `setOpacity()` : cette méthode ternirait aussi le texte.
- Déplacer passe par `movementX` / `movementY` (pixels CSS), pas par `screenX` (pixels physiques : trop vite dès que l'affichage est zoomé).
- Autour de `setBounds`, le minimum et le maximum sont élargis. Si la taille minimale égale la taille maximale, Windows ignore le changement de position.
- Au relâchement, le clavier revient à Dofus (`AttachThreadInput` + `SetForegroundWindow` dans `focusGame`).
- Le script de suivi considère que Dofus est toujours devant si le bandeau lui-même est au premier plan. Sinon le bandeau se cache pendant qu'on le déplace.
- Le script PowerShell est recopié en mémoire avant d'être lancé : une fois empaqueté, il est dans `app.asar`, et PowerShell ne peut pas l'ouvrir par son chemin.

Le texte du bandeau a une ombre légère pour rester lisible sur un fond de jeu clair. Les boutons n'ont pas cette ombre.

Pour changer l'apparence : `overlay.tsx` et `src/styles.css` (jetons `pine`, `lamp`, `fog`, `mist`). Pour changer ce qui est mesuré : `overlayStat` dans `overlay.ts`. Pour changer les tailles en pixels : `OVERLAY_SIZES` et le texte d'aide dans `settings-view.tsx`, les deux en même temps.

### 5.6 Raccourcis

Page : `src/components/pupitre/shortcuts-view.tsx`. Défauts : `DEFAULT_SHORTCUTS` dans `store.ts` et la même table dans `main.cjs`.

| Action | Défaut | Effet |
|---|---|---|
| `overlay` | Ctrl+Maj+F9 | Affiche ou cache le bandeau |
| `start` | Ctrl+Maj+F6 | Démarre ou reprend la session |
| `pause` | Ctrl+Maj+F7 | Pause |
| `stop` | Ctrl+Maj+F8 | Termine la session |
| `reset` | Ctrl+Maj+F10 | Remet la session à zéro, sans l'historique |
| `combat` | Ctrl+Maj+F5 | +1 combat |

Electron enregistre des accélérateurs globaux. Ils ne marchent que dans l'exe, et seulement si la combinaison est libre. La page affiche l'échec. Échap annule une saisie. **Rétablir les défauts** réécrit la table.

Les deux copies (`store.ts` et `main.cjs`) doivent rester identiques. La page envoie la table au processus, qui l'écrit dans `shortcuts.json` pour la retrouver au prochain lancement, avant même que la page ait fini de s'hydrater.

### 5.7 Lecture réseau

Fichiers : `desktop/game-net/reader.cjs`, `decode.cjs`, `preload.cjs` (canal `net`), écran `src/components/pupitre/network-view.tsx`.

Wireshark, avec Npcap coché à l'installation, fournit `tshark.exe`. Pupitre le cherche dans `PUPITRE_TSHARK`, puis dans `Program Files\Wireshark`. L'onglet dit **À l'écoute** quand tshark tourne.

Le filtre ne garde que le trafic vers les noms de serveurs listés dans `SERVERS` (`rafal`, `draconiros`, `ombre`, …), ports 5555 et 443. Les adresses sont résolues en DNS et mises en cache 12 heures (`game-servers.json`). Les cartes virtuelles (WSL, Hyper-V, VPN) sont écartées tant qu'il reste une carte réelle.

`decode.cjs` reconstitue les flux TCP et lit les messages protobuf dont le type est une URL `type.ankama.com/…`. Le nom court est la dernière partie (`jwe`). `direction` vaut `in` quand le serveur parle, `out` quand le client parle.

La lecture s'arrête d'elle-même cinq secondes après que plus personne ne la demande (session arrêtée, onglet quitté, alertes décochées).

Ce qui est branché sur ces messages :

| Besoin | Module | Noms au 29/09/2026 |
|---|---|---|
| Combats et butin | `fights.cjs` | `jvt`, `jwd`, `jwc`, `jwe`, et en sortie `jrj`, `jvv` |
| Hôtel des ventes | `market.cjs` | `ket`, `jzn` (la demande est `kde`, non décodée) |
| Avis et archimonstres | `wanted.cjs` | `jpo`, `joq`, `jpt`, plus le texte de groupe dans le chat |
| « Les codes ont changé » | `known-types.cjs` | Toute la liste vue ce jour-là |

L'alerte de codes périmés s'allume dans l'onglet Réseau après au moins 300 messages et 15 types distincts, si moins de 40 % de ces types sont dans `KNOWN_TYPES`. Avant ça, l'état est « pas encore assez de trafic ». Ce n'est pas une panne.

### 5.8 Combats, personnage reconnu, butin

`fights.cjs`, commentaires en tête de fichier. Les numéros de champs viennent de captures du 29/09/2026, et pour les noms d'origine de Blitzkrieg 1.42 (MIT), déjà crédité dans le README. On ne recopie pas le code d'un autre outil : une capture suffit.

| Message | Rôle | Forme à reconnaître |
|---|---|---|
| `jvt` `in` | Ordre des combattants | Champ `1`, une entrée par combattant, id dans `2.1`. L'id « personne » est `18446744073709551615` |
| `jwd` `in` | Début de tour | Champ `7` : id de celui dont c'est le tour |
| `jwc` `in` | Fin de tour | Champ `1` : le même id |
| `jwe` `in` | Fin de combat | Champ `4` : durée en ms. Champ `5` : un bloc par combattant, XP, kamas, objets (`1` = id, `4` = quantité) |
| `jrj`, `jvv` `out` | Action pendant ton tour | Un sort, ou passer. Absents pendant le tour d'un autre |

Plusieurs comptes dans le même combat reçoivent les mêmes messages, chacun sur sa connexion. Les événements sont fusionnés : un combat ne compte qu'une fois (`SAME_FIGHT_MS`, cinq secondes).

Pupitre apprend l'id du personnage quand cette connexion lance un sort ou passe son tour (`onOwnFighter` → `own-fighters.json`). Avant ça, il ne crédite le butin que s'il n'y a qu'un seul gagnant (combat solo). À plusieurs, l'onglet affiche que le butin n'est pas attribué et n'ajoute rien. Le bouton **Oublier** efface les id retenus.

### 5.9 Hôtel des ventes

`market.cjs`.

| Message | Moment | Forme |
|---|---|---|
| `ket` `in` | Ouverture du mode vente | Champ `2` : une ligne par objet en vente. `1.2` = id d'objet, `1.3` = taille du lot, `2` = prix du lot |
| `jzn` `in` | Clic sur un objet en mode achat | Champ `1` : id d'objet. Champ `2.6` : prix des lots, varints compactés, un 0 s'il n'y a pas de lot. Ordre : 1, 10, 100, 1000 |
| `kde` `out` | Juste avant `jzn` | Champ `2` : l'id demandé. Pupitre ne décode pas cette demande |

Pupitre garde le lot le moins cher par unité et l'applique aux lignes de la session dont l'id d'objet correspond, badge HDV. Mille prix au plus (`HDV_PRICES_KEPT`). **Oublier** dans Réseau vide ce cache. Un prix tapé à la main a `priceFrom: "manuel"` et n'est pas remplacé.

Les gros messages répétés sans prix sont en général l'inventaire (`isb` à cette date), pas l'HDV. Un message qui contient une phrase lue dans le chat est un message de chat, pas un code de combat.

### 5.10 Avis de recherche et archimonstres

Détection : `desktop/game-net/wanted.cjs`. Listes : `wanted-monsters.json` (quêtes « avis de recherche ») et `archmonsters.json` (DofusDB `isMiniBoss`, 306 entrées). Carte : `src/components/pupitre/wanted-toast.tsx`. Réglages : `WantedCard` dans `settings-view.tsx`. Bandeau de rappel : `WantedBanner` dans `desk.tsx`. Ligne dans Réseau : `WantedNotice` dans `network-view.tsx`.

Chaque monstre a `id`, `name`, `level`, `gfxId`. Le genre est posé au chargement : `wanted` ou `archi`. Aucun id n'est dans les deux listes ; si cela arrivait, l'avis de recherche gagnerait.

En arrivant sur une carte, le message `jpo` décrit la population. Champ `6` : id de la carte. Champ `9` : les acteurs. Un groupe de monstres a un id contextuel négatif, vers `-20000` (le champ `2` de l'acteur). Ce n'est pas `-1`, qui est une sentinelle de combat. Dans le groupe, champ `2` = id du monstre, champ `3` = niveau (1 à 200).

`joq` (`in`, champ `3` = id d'acteur) retire un groupe qui s'en va. `jpt` (`out`, champ `3` = id de la carte de destination) sert au déplacement. Un lien de chat peut décrire un groupe sans revoir `jpo` : texte `4x3851x200|1x3838x200` (nombre, id, niveau) et champ `8` = id du groupe.

L'image du monstre est `https://api.dofusdb.fr/img/monsters/{gfxId}.png`. L'icône d'archimonstre est le Dofus ocre `https://www.metamob.fr/img/ocre.png`. Si l'image manque, la carte reste lisible : initiale du nom, ou icône masquée.

La carte fait 148 × 168 pixels, trois au plus, empilées. Elle se ferme à 10 secondes ou par la croix. Un archimonstre a une bordure plus forte, un halo ocre, le nom en couleur lampe, et le Dofus ocre devant le nom. Les deux alertes se coupent séparément. La détection tourne pour les deux ; `reader.cjs` filtre selon les cases et recalcule la phrase.

Les coordonnées ne sont pas dans le paquet. `map-coords.cjs` appelle `https://api.dofusdb.fr/map-positions/{id}` et met `{x, y}` en cache. Il n'existe pas de formule fiable de l'id vers `posX, posY` : il faut cet appel, par id de carte. La carte d'alerte attend environ 1,5 s pour s'ouvrir déjà avec `/travel x,y`. Un clic copie la commande. Le presse-papiers n'accepte que le motif `/travel` suivi de deux entiers.

La position de la carte est `toast.json`. Même contrainte Windows que le bandeau : déverrouiller min et max autour de `setBounds`, deltas `movementX` / `movementY`.

Réactiver une case alors qu'on est déjà sur la carte ne relance pas l'alerte. Le drapeau « déjà signalé » ne se vide qu'au changement de carte.

Pour mettre les listes à jour (un nouvel archimonstre, un avis ajouté par Ankama), on régénère le JSON depuis DofusDB, sans toucher aux noms de messages :

- Avis : monstres de quête « avis de recherche » (`isQuestMonster`, catégorie de quête 6). Champs gardés : `id`, `name` français, `level`, `gfxId`.
- Archimonstres : `isMiniBoss=true`. L'API limite à 50 lignes : paginer avec `$skip`.

Trier par `id`. Ne pas inventer un id. Après coup, `node --test scripts/game-net.test.mjs` : les tests citent Ka'Youloud (`4737`), Amy (`3528`) et Kiroyal (`2508`, archi, `gfxId` 90).

### 5.11 Icône de l'application

| Fichier | Rôle |
|---|---|
| `build/icon.svg` | Dessin complet : œuf ocre, facettes, anneau de chronomètre, sur un carré arrondi `#1a120c` / `#e0a33a` |
| `build/icon-small.svg` | Le même œuf, sans anneau ni facettes. Sert aux tailles 16, 24 et 32 px, sinon tout se confond |
| `scripts/make-icon.mjs` | Dessine les PNG et assemble `build/icon.ico` |
| `build/icon.ico` | Icône de l'installeur, du raccourci et de l'exe (`build.win.icon`) |
| `build/icon.png` | Aperçu 512 px, pas lu par Windows |
| `desktop/icon.png` | Icône de la fenêtre Electron hors installateur (`icon` du `BrowserWindow`) |
| `public/favicon.svg` | Onglet de l'aperçu web uniquement |

Pour changer l'icône : éditer les deux SVG, puis lancer `node scripts/make-icon.mjs`. Le script ouvre Chromium via Playwright. S'il ne trouve pas le navigateur embarqué, poser `CHROME_PATH` vers un Chrome installé. Vérifier le résultat à 16 px : c'est la taille de la barre des tâches. Puis publier une nouvelle version : l'icône est gravée à la construction, une copie déjà installée ne la reçoit qu'avec la mise à jour.

`signAndEditExecutable` ne doit pas être remis à `false` : sans édition de l'exe, Windows continue d'afficher la page blanche par défaut, même si le fichier `.ico` est là.

### 5.12 Mise à jour de Pupitre lui-même

Workflow : `.github/workflows/windows-exe.yml`, sur chaque étiquette `v*`.

1. Monter `version` dans `package.json` (et les deux champs `version` de la racine dans `package-lock.json`, pas ceux des dépendances).
2. Commit, pousser, poser l'étiquette `vX.Y.Z` sur ce commit, pousser l'étiquette.
3. Le workflow lance `npm run desktop:build` puis `electron-builder --win nsis` sur `windows-latest`. Le dépôt Linux ne peut pas produire l'exe NSIS.
4. Sans tiret dans l'étiquette (`v0.1.15`) : version stable, `latest.yml`, proposée à tout le monde.
5. Avec un tiret (`v0.1.15-beta.1`) : bêta, `beta.yml`. Seules les copies déjà en bêta la reçoivent. Passer d'une bêta à une stable demande d'installer le Setup stable une fois.

L'installeur est par utilisateur, sans droit administrateur, raccourci Bureau et menu Démarrer. Les sessions et réglages restent dans `%APPDATA%\Pupitre`.

---

## 6. Réparer après une mise à jour de Dofus

### 6.1 Ce qui continue, ce qui s'arrête

Le bandeau, le chronomètre, les raccourcis, l'icône, la saisie manuelle, l'historique, l'export et la recherche DofusDB ne lisent pas les noms de messages. Ils continuent.

S'arrêtent tant que les codes ne sont pas repris : le combat compté tout seul, le butin, les prix d'HDV, les avis de recherche, les archimonstres, et l'alerte « Dofus a sans doute changé ses codes » se met à s'afficher (c'est voulu).

L'id des monstres, l'id des objets et l'id des cartes ne changent pas quand Ankama renomme les messages. Inutile de régénérer les JSON pour un simple renommage.

### 6.2 Prendre une capture

Wireshark installé, onglet Réseau **À l'écoute**. La lecture ne tourne que pendant une session, ou tant que l'onglet est ouvert, ou tant qu'une alerte de carte est cochée.

1. **Capturer les paquets**.
2. En jeu, sans se presser, et en notant ce que l'écran affiche :
   - un combat seul de préférence : début, un sort pendant ton tour, fin de tour, fin. Note les kamas et un objet gagnés ;
   - l'HDV en mode vente, avec un prix que tu connais ;
   - l'HDV en mode achat : ouvre une catégorie, clique un objet, lis le prix par 1, par 10 et par 100 ;
   - un changement de carte vers un groupe dont tu connais un monstre, si les alertes sont à reprendre.
3. **Arrêter**, puis **Ouvrir le dossier**.

Fichier : `%APPDATA%\Pupitre\packet-captures\capture-….ndjson`. Une ligne JSON par message (`type`, `direction`, `fields`, `at`, `size`). Il contient l'id du personnage et le chat. On le garde en local. On ne le pousse pas sur GitHub.

### 6.3 Voir si les noms ont bougé

Depuis la racine du dépôt, avec le chemin de la capture :

```bash
node -e "
const fs = require('fs');
const { KNOWN_TYPES } = require('./desktop/game-net/known-types.cjs');
const lines = fs.readFileSync(process.argv[1], 'utf8').trim().split('\n').map(JSON.parse);
const counts = new Map();
for (const m of lines) counts.set(m.type, (counts.get(m.type) || 0) + 1);
const unknown = [...counts.keys()].filter(t => !KNOWN_TYPES.has(t)).sort();
console.log(lines.length, 'messages,', counts.size, 'types,', unknown.length, 'inconnus');
console.log(unknown.join(' ') || 'aucun nom nouveau');
" chemin/vers/capture.ndjson
```

- Aucun nom nouveau, et les combats marchent encore : rien à changer.
- Quelques noms nouveaux au milieu de noms connus : le jeu a ajouté des messages. Ajoute-les à `KNOWN_TYPES` pour que l'alerte ne s'allume pas pour rien. Les combats peuvent encore marcher.
- Presque tous les noms sont nouveaux : il faut retrouver chaque message utile par sa forme, pas par son ancien nom.

Pour imprimer un type :

```bash
node -e "
const fs = require('fs');
const lines = fs.readFileSync(process.argv[1], 'utf8').trim().split('\n').map(JSON.parse);
for (const m of lines) {
  if (m.type !== process.argv[2]) continue;
  const s = JSON.stringify(m.fields);
  console.log(m.at.slice(11, 19), m.direction, m.type, m.size, s.length > 500 ? s.slice(0, 500) + '…' : s);
}
" chemin/vers/capture.ndjson NOM
```

Compare avec un chiffre vu à l'écran (des kamas, un prix, un id d'objet). L'id du personnage est dans `own-fighters.json` : en fin de combat, le bloc qui porte tes kamas a cet id.

Si la forme ne colle plus (pas de kamas là où le commentaire les attend), les numéros de champs ont bougé aussi. Mets à jour le commentaire en tête du fichier en même temps que le `payload.get(…)` ou le `varintField(…, n)` correspondant.

### 6.4 Fichiers à modifier, dans l'ordre

1. `desktop/game-net/fights.cjs` : les quatre noms de `CODES`, et `OWN_TURN_REQUESTS` si les requêtes de ton tour ont changé de nom. Les numéros de champs si la forme a bougé.
2. `desktop/game-net/market.cjs` : `sellerListings` et `itemPrices`.
3. `desktop/game-net/wanted.cjs` : les noms `jpo`, `joq` et `jpt` si les alertes de carte ne partent plus. Pas les JSON, sauf si un monstre a vraiment été ajouté au jeu.
4. `desktop/game-net/known-types.cjs` : remplace la liste par **tous** les types vus dans la nouvelle capture (quelques minutes de jeu, un combat, l'HDV, un changement de carte). Une liste à moitié ancienne laisse l'alerte allumée, ou l'éteint trop tôt.
5. `scripts/game-net.test.mjs` : les tests nomment les mêmes codes. Remplace les noms. Pour l'HDV, garde les octets réels de la nouvelle capture, comme les tests « Aile de Tofu » le font avec ceux du 29/09.

Puis :

```bash
node --test scripts/game-net.test.mjs
npm run typecheck
```

Les tests réseau doivent passer, y compris un combat synthétique et les prix lus sur les octets de ta capture.

La page Réseau, le bandeau et la carte d'alerte n'ont pas les noms de messages en dur. Inutile de les modifier pour un renommage. On les touche seulement si la forme affichée change (un champ de plus, un texte différent).

### 6.5 Publier la réparation

Même circuit que la section 5.12 : numéro de version, étiquette `v*` sans tiret pour que tout le monde la reçoive. Le bandeau et l'icône de cette version partent avec, puisqu'ils sont dans le même exe.

---

## 7. Vérifier sans casser le jeu

- `node --test scripts/game-net.test.mjs` et `scripts/static-server.test.mjs` : pas besoin de Dofus ni de Windows.
- `npm run typecheck` : les types de `window.pupitre` et du magasin.
- L'aperçu web (`npm run dev`) montre le bureau, les réglages et une carte d'alerte si on ouvre `/avis` avec un paramètre `m`. Il ne peut pas suivre la fenêtre Dofus ni lire les paquets.
- L'exe ne se construit que sur le workflow Windows. `npx electron-builder --win nsis` lancé sous Linux ne va pas au bout.

Garde `contextIsolation: true`, `sandbox: true` et `nodeIntegration: false` dans `webPreferences`. Le preload est le seul pont. N'ajoute pas de droit d'écriture sur la socket du jeu : le projet ne le fait nulle part, et ce n'est pas une réparation.

---

## 8. Symptôme, endroit

| Ce que tu vois | Où regarder |
|---|---|
| L'ouverture est longue, l'installation dépasse largement 300 Mo | Une vieille construction embarque encore le serveur Nitro (`.output` entier) ou toutes les langues Chromium. Vérifier `extraResources` (seulement `.output/public`) et `electronLanguages` |
| L'exe n'a pas d'icône, page blanche | `build/icon.ico` absent de `build.win`, ou `signAndEditExecutable: false` |
| Le bandeau ne se déplace pas | `focusable`, `setBounds` avec min = max, ou le script de suivi qui le recolle |
| Le bandeau est invisible sur le jeu | Fenêtre non transparente, ou opacité à 20 % sur un fond clair : monter le curseur. Le fond de la page du bandeau doit rester transparent |
| Le clavier reste dans Pupitre après un déplacement | `focusGame` dans `main.cjs` |
| Les combats ne se comptent plus, l'onglet Réseau alerte | Section 6. Capture, puis `fights.cjs` et `known-types.cjs` |
| Le butin dit « non attribué » | Normal à plusieurs tant que le personnage n'a pas joué un tour depuis ce PC. Sinon `own-fighters.json` |
| L'HDV n'applique pas un prix | La ligne a été tapée à la main, ou `ket` / `jzn` ont été renommés |
| Pas d'alerte sur un monstre connu | Case décochée dans Réglages, ou id absent du JSON, ou `jpo` renommé. Pas de seconde alerte sans changer de carte |
| `/travel` absent | DofusDB `map-positions` n'a pas répondu. L'alerte reste valable sans coordonnées. Le cache est `map-coords.json` |
| Les raccourcis ne marchent pas dans l'aperçu web | Normal : seulement dans l'exe, et si la combinaison est libre |
| Une bêta ne passe pas à la stable | Voulu. Installer le Setup stable une fois |
