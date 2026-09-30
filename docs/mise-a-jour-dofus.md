# Mettre Pupitre à jour après une mise à jour de Dofus

Pupitre ne se connecte pas au jeu et n'envoie rien. Il reconnaît quelques messages déjà présents sur la connexion, par leur nom court (`jwe`, `ket`, …). À une mise à jour du client, Ankama renomme en général **tous** ces noms d'un coup. Le bandeau, le chronomètre, les raccourcis et la saisie manuelle continuent de marcher. Ce qui s'arrête, c'est la lecture automatique.

| Continue de marcher | S'arrête tant que les codes ne sont pas repris |
|---|---|
| Session, chronomètre, bandeau, historique, export Excel | Combats comptés tout seuls |
| Prix tapés à la main | Butin et kamas ajoutés à la fin du combat |
| Recherche d'objets (DofusDB) | Prix lus à l'hôtel des ventes |
| Personnage enregistré dans Pupitre | Alerte « Dofus a sans doute changé ses codes » |

L'alerte s'affiche dans l'onglet **Réseau** après au moins 300 messages et 15 types différents, si moins de 40 % de ces types sont dans la liste connue (`desktop/game-net/known-types.cjs`). Pas d'alerte au bout de quelques secondes : il faut jouer un peu.

Les conditions d'utilisation d'Ankama interdisent les logiciels tiers qui lisent le trafic du jeu. La suite se fait à tes risques pour le compte.

## 1. Enregistrer une capture

Wireshark (avec Npcap) doit être installé, et l'onglet **Réseau** doit indiquer **À l'écoute**. Démarre une session, ou reste sur cet onglet : sinon la lecture est coupée.

1. **Capturer les paquets**.
2. En jeu, dans l'ordre, sans te presser :
   - un combat complet, seul de préférence : début, un sort pendant ton tour, fin de tour, fin du combat. Note les kamas et un objet gagnés, tels qu'affichés à l'écran ;
   - l'hôtel des ventes en **mode vente** (ouvre-le, tes objets en vente ont un prix que tu connais) ;
   - l'hôtel des ventes en **mode achat** : ouvre une catégorie, clique un objet, lis le prix par 1, par 10 et par 100.
3. **Arrêter la capture**, puis **Ouvrir le dossier**.

Le fichier est `%APPDATA%\Pupitre\packet-captures\capture-….ndjson` : une ligne JSON par message. Il contient l'identifiant de ton personnage et le chat. Ne le publie pas sur GitHub. Garde-le en local, ou envoie-le en privé à la personne qui met Pupitre à jour.

## 2. Voir ce qui a changé

Dans le dossier du projet :

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

- **Aucun nom nouveau**, et les combats marchent encore : la mise à jour de Dofus n'a pas touché ces codes. Rien à changer.
- **Quelques noms nouveaux** au milieu de noms connus : le jeu a ajouté des messages. Ajoute-les à `KNOWN_TYPES` pour que l'alerte ne s'allume pas pour rien. Les combats peuvent encore marcher.
- **Presque tous les noms sont nouveaux** : Ankama a renommé la série. Il faut retrouver les messages utiles par leur forme, pas par leur ancien nom.

Pour imprimer un message lisible :

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

`direction` vaut `in` quand le jeu parle, `out` quand ton client parle.

## 3. Retrouver les messages

Le plus souvent, seul le nom de trois lettres change. Les numéros de champs restent ceux commentés dans le code. Compare la forme, et un chiffre que tu as vu à l'écran (des kamas, un prix, un objet).

| Rôle | Nom actuel (29/09/2026) | Où c'est écrit | Comment le reconnaître dans la capture |
|---|---|---|---|
| Ordre des combattants | `jvt` | `CODES.fightOrder` | `in`, au début du combat. Champ `1` : une entrée par combattant, identifiant dans `2.1`. L'identifiant « personne » est `18446744073709551615`. |
| Début de tour | `jwd` | `CODES.turnStart` | `in`, juste avant ton sort. Champ `7` : l'identifiant du combattant dont c'est le tour. |
| Fin de tour | `jwc` | `CODES.turnEnd` | `in`, juste après. Champ `1` : le même identifiant. |
| Fin de combat | `jwe` | `CODES.fightEnd` | `in`, à la fin. Champ `4` : durée en millisecondes. Champ `5` : un bloc par combattant, avec l'XP, les kamas (ceux notés à l'écran) et les objets (`1` = id d'objet, `4` = quantité). |
| Action pendant ton tour | `jrj`, `jvv` | `OWN_TURN_REQUESTS` | `out`, seulement pendant ton tour (le sort, ou passer). Ils ne doivent pas apparaître pendant le tour d'un autre. |
| Tes ventes à l'HDV | `ket` | `MARKET_CODES.sellerListings` | `in`, à l'ouverture du mode vente. Champ `2` : une ligne par objet en vente, `1.2` = id d'objet, `1.3` = taille du lot (1, 10, 100), `2` = prix du lot. |
| Prix du marché | `jzn` | `MARKET_CODES.itemPrices` | `in`, juste après le clic sur un objet en mode achat. Champ `1` : l'id d'objet. Champ `2.6` : les prix des lots, varints compactés, un 0 s'il n'y a pas de lot. L'ordre est 1, puis 10, puis 100, puis 1000. |
| Demande de ce prix | `kde` | commentaire de `market.cjs` | `out`, juste avant `jzn`. Champ `2` : l'id de l'objet cliqué. Pupitre ne décode que la réponse. |
| Population de la carte | `jpo` | `wanted.cjs` | `in`, en changeant de carte. Champ `6` : id de la carte. Champ `9` : un acteur. Un groupe de monstres a un id négatif (vers `-20000`) dans le champ `2`. Dans le groupe, champ `2` = id du monstre, champ `3` = niveau. |
| Déplacement | `joq` / `jpt` | `wanted.cjs` | `joq` est `in`, champ `3` = id de l'acteur (négatif pour un groupe). `jpt` est `out`, champ `3` = id de la carte. |
| Description d'un groupe | dans le lien de chat | `wanted.cjs` | Texte du genre `4x3851x200` puis `1x3838x200` : nombre, id de monstre, niveau. Champ `8` : id du groupe. Sert quand la population n'a pas été revue. |

L'id de ton personnage est dans `%APPDATA%\Pupitre\own-fighters.json`. En fin de combat, le bloc qui porte tes kamas a cet id.

Si la forme ne colle pas (pas de kamas là où le commentaire les attend, prix illisibles), les numéros de champs ont bougé aussi. Les commentaires en tête de `desktop/game-net/fights.cjs` et `desktop/game-net/market.cjs` décrivent la forme du 29/09/2026 : mets les commentaires à jour en même temps que les numéros lus dans le code (`payload.get(5)`, `varintField(…, 7)`, etc.).

Les gros messages répétés sans prix sont en général l'inventaire (`isb` à cette date), pas l'hôtel des ventes. Un message de chat contient le texte que tu as lu à l'écran : ce n'est pas un code de combat.

## 4. Modifier le code

1. `desktop/game-net/fights.cjs` : les quatre noms de `CODES`, et `OWN_TURN_REQUESTS` si les requêtes de ton tour ont changé de nom.
2. `desktop/game-net/market.cjs` : `sellerListings` et `itemPrices`.
3. `desktop/game-net/wanted.cjs` : les noms `jpo`, `joq` et `jpt` si les avis de recherche ne sont plus signalés. Les id de monstres, eux, sont dans `wanted-monsters.json` (DofusDB) et ne changent pas avec le renommage des messages.
4. `desktop/game-net/known-types.cjs` : remplace la liste par **tous** les types vus dans la nouvelle capture (un passage en jeu de quelques minutes, combat compris, plus l'HDV). Une liste à moitié ancienne laisse l'alerte allumée, ou l'éteint trop tôt.
5. `scripts/game-net.test.mjs` : les tests nomment les mêmes codes (`jvt`, `jwe`, `jrj`, `ket`, `jzn`, `jpo`, …). Remplace-les par les nouveaux noms. Garde les octets réels de la nouvelle capture pour l'HDV, comme les tests « Aile de Tofu » le font avec la capture du 29/09.

Ne copie pas le code d'un autre outil. Les noms de combat d'origine viennent de Blitzkrieg 1.42 (licence MIT), déjà crédités dans le README. Une capture suffit pour la suite.

Vérifie :

```bash
node --test scripts/game-net.test.mjs
npm run typecheck
```

Les tests réseau doivent passer, y compris un combat synthétique et les prix HDV lus sur les octets de ta capture.

## 5. Publier

Dans `package.json`, passe le numéro de version (par exemple `0.1.13`).

Une étiquette `v*` lancée sur GitHub construit `Pupitre-Setup-<version>.exe` et le publie dans les [versions](https://github.com/Macleeog/pupitre/releases). Sans tiret dans le numéro (`v0.1.13`), c'est une version stable, proposée à tout le monde. Avec un tiret (`v0.1.13-beta.1`), c'est une bêta : seules les copies déjà en bêta la reçoivent.

Les copies installées avec le Setup cherchent une version au lancement, puis toutes les 4 heures. Une bêta ne passe pas toute seule à la version stable : il faut installer le Setup stable une fois. Les sessions et les réglages restent dans `%APPDATA%\Pupitre\`.
