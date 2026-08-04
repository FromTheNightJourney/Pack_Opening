const express = require('express');
const cors = require('cors');
const fs = require('fs');
const readline = require('readline');

const app = express();
app.use(cors());

// populate array line by line
const allCards = [];

// bonus sheet config -- need to add more
const setConfigs = {
  woe: { bonusSheet: 'wot', hasBonusSheet: true, bonusChance: 1 },
  otj: { bonusSheet: 'otp', hasBonusSheet: true, bonusChance: 1 },
  fin: { bonusSheet: 'fca', hasBonusSheet: true, bonusChance: 1/3 },
  eoe: { bonusSheet: 'eos', hasBonusSheet: true, bonusChance: 1/8 },
  msh: { bonusSheet: 'mar', hasBonusSheet: true, bonusChance: 1/24,
    minCollector: 41,
    maxCollector: 100
  },
  spm: { bonusSheet: 'mar', hasBonusSheet: true, bonusChance: 1/24,
    minCollector: 1,
    maxCollector: 40,
  },
  mh3: { hasBonusSheet: false },
  tla: { bonusSheet: 'tle', hasBonusSheet: true, bonusChance: 1/25 },
};

const filterCards = (set, rarity, excludeBasicLands = true, isBonusSheet = false) => {
  
  return allCards.filter(c => {
    (isBonusSheet || c.booster !== false || c.promo_types?.includes('boosterfun') || set === 'msh')

    if (c.set !== set || c.rarity !== rarity) return false;
    if (excludeBasicLands && c.type_line && c.type_line.includes("Basic Land")) return false;
    if (c.promo_types && c.promo_types.includes('serialized')) return false;
    if (c.promo_types && (c.promo_types.includes('gameday') || c.promo_types.includes('release') || c.promo_types.includes('prerelease'))) return false;
    if (isBonusSheet) return true;
    if (c.booster === false && !c.promo_types?.includes('boosterfun')) return false;
    return true;
  });
};

const getRandom = (arr) => {
  if (arr.length === 0) return null;

  // unique card names to fix the math weighting
  const uniqueNames = [...new Set(arr.map(c => c.name))];

  // pick name at random
  const selectedName = uniqueNames[Math.floor(Math.random() * uniqueNames.length)];

  // find all printings (arts) of that specific card in the current pool
  const variants = arr.filter(c => c.name === selectedName);

  // pick one of the art variants at random
  return variants[Math.floor(Math.random() * variants.length)];
};

const roll = (chance) => Math.random() < chance;

const pickWildcardRarity = () => {
  if (roll(0.01)) return 'mythic';
  if (roll(0.07)) return 'rare';
  if (roll(0.20)) return 'uncommon';
  return 'common';
};

const getWildcard = (set) => {
  const rarity = pickWildcardRarity();
  const pool = filterCards(set, rarity);
  return getRandom(pool) || getRandom(filterCards(set, 'common'));
};

app.get('/api/open-pack', (req, res) => {
  let mainSet = req.query.set?.toLowerCase().trim();
  console.log(`📥 Incoming pack request for set: ${mainSet}`);
  if (!mainSet) return res.status(400).json({ error: "Set code required" });

  const config = setConfigs[mainSet] || { hasBonusSheet: false };
  let pack = [];

  try {
    const commons = filterCards(mainSet, 'common');
    const uncommons = filterCards(mainSet, 'uncommon');
    const rares = filterCards(mainSet, 'rare');
    const mythics = filterCards(mainSet, 'mythic');
    const basicLands = allCards.filter(c => c.set === mainSet && c.type_line && c.type_line.includes("Basic Land"));

    if (commons.length === 0) {
      return res.status(404).json({ error: `Could not find standard booster cards for set '${mainSet}'. You may need to redownload a fresh cards.jsonl from Scryfall!` });
    }

    // slot 1-6
    for(let i=0; i<6; i++) pack.push(getRandom(commons));

    // slot 7: bonus sheet or wild card
    const bonusChance = config.bonusChance !== undefined ? config.bonusChance : 1;

    if (config.hasBonusSheet && roll(bonusChance)) {
      console.log(`🎁 Bonus sheet triggered for ${mainSet}, using set ${config.bonusSheet}`);

      const rarityRoll = Math.random();
      let rarity = 'uncommon';
      if (rarityRoll < 0.066) {
        rarity = 'mythic';
      } else if (rarityRoll < 0.33) {
        rarity = 'rare';
      }
      console.log(`   Rolled rarity: ${rarity}`);

      let bonusPool = filterCards(config.bonusSheet, rarity, false, true);

      if (config.minCollector && config.maxCollector) {
        const before = bonusPool.length;
        bonusPool = bonusPool.filter(c =>
          parseInt(c.collector_number) >= config.minCollector &&
          parseInt(c.collector_number) <= config.maxCollector
        );
        console.log(`   Collector number filter reduced pool from ${before} to ${bonusPool.length}`);
      }

      console.log(`   Bonus pool size (rarity ${rarity}): ${bonusPool.length}`);

      if (bonusPool.length > 0) {
        const card = getRandom(bonusPool);
        console.log(`   ✅ Picked bonus card: ${card.name} (${card.set} #${card.collector_number})`);
        pack.push(card);
      } else {
        console.log(`   ⚠️  Empty bonus pool – falling back to main set common`);
        pack.push(getRandom(commons));
      }
    } else {
      const wildcardRarity = pickWildcardRarity();
      const wildcardPool = filterCards(mainSet, wildcardRarity);
      pack.push(getRandom(wildcardPool) || getRandom(commons));
    }

    // slot 8-10
    for(let i=0; i<3; i++) pack.push(getRandom(uncommons));

    // slot 11
    if (roll(1/8) && mythics.length > 0) {
      pack.push(getRandom(mythics));
    } else {
      pack.push(getRandom(rares));
    }

    // slot 12
    const foilCard = getWildcard(mainSet);
    pack.push(foilCard);

    // slot 13
    if (basicLands.length > 0) pack.push(getRandom(basicLands));
    else pack.push(getRandom(commons));

    // slot 14
    const tokenSet = 't' + mainSet;
    const tokens = allCards.filter(c => c.set === tokenSet || c.layout === 'token');

    if (tokens.length > 0) {
      pack.push(getRandom(tokens));
    } else {
      pack.push({
        id: 'token-placeholder',
        name: 'Token / Ad Card',
        image_uris: { normal: 'https://cards.scryfall.io/large/front/f/5/f591244f-3760-464a-b501-72996d934bb6.jpg' },
        rarity: 'common'
      });
    }

    const formattedPack = pack.map((c, index) => {
      const imageUri = c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal;
      return {
        id: c.id,
        name: c.name,
        set: c.set,
        collector_number: c.collector_number,
        image: imageUri || '',
        rarity: c.rarity,
        isFoil: index === 11,
        isBonusSheet: config.hasBonusSheet && c.set === config.bonusSheet
      };
    });

    res.json(formattedPack);
  } catch (err) {
    console.error("Pack Generation Error:", err);
    res.status(500).json({ error: "Server crashed during pack generation. Check backend terminal." });
  }
});

console.log("Streaming cards.jsonl into memory... This might take a minute.");

const fileStream = fs.createReadStream('./cards.jsonl');
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  if (line.trim()) {
    try {
      allCards.push(JSON.parse(line));
    } catch (e) {
      // optionally log bad lines
    }
  }
});

rl.on('close', () => {
  console.log(`Successfully loaded ${allCards.length} cards.`);

  app.listen(3005, () => console.log('Backend running on http://localhost:3005'));
});