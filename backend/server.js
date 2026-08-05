const express = require('express');
const cors = require('cors');
const fs = require('fs');
const readline = require('readline');

const app = express();
app.use(cors());
const allCards = [];

const cardIndex = {};
const setConfigs = {
  woe: { bonusSheet: 'wot', hasBonusSheet: true, bonusChance: 1 },
  otj: { bonusSheet: 'otp', hasBonusSheet: true, bonusChance: 1 },
  fin: { bonusSheet: 'fca', hasBonusSheet: true, bonusChance: 1/3 },
  eoe: { bonusSheet: 'eos', hasBonusSheet: true, bonusChance: 1/8 },
  msh: {
    bonusSheet: 'mar',
    hasBonusSheet: true,
    bonusChance: 1/24,
    minCollector: 41,
    maxCollector: 100
  },
  spm: {
    bonusSheet: 'mar',
    hasBonusSheet: true,
    bonusChance: 1/24,
    minCollector: 1,
    maxCollector: 40
  },
  mh3: { hasBonusSheet: false },
  tla: { bonusSheet: 'tle', hasBonusSheet: true, bonusChance: 1/25 }
};


const roll = (chance) => Math.random() < chance;

const pickWildcardRarity = () => {
  const r = Math.random();
  if (r < 0.024) return 'mythic';
  if (r < 0.166) return 'rare';
  if (r < 0.583) return 'uncommon';
  return 'common';
};

const getRandom = (arr) => {
  if (!arr || arr.length === 0) return null;

  const uniqueNames = [...new Set(arr.map(c => c.name))];
  const name = uniqueNames[Math.floor(Math.random() * uniqueNames.length)];
  const variants = arr.filter(c => c.name === name);

  return variants[Math.floor(Math.random() * variants.length)];
};

// card filtering

const buildIndex = () => {
  for (const c of allCards) {
    if (!cardIndex[c.set]) cardIndex[c.set] = {};
    if (!cardIndex[c.set][c.rarity]) cardIndex[c.set][c.rarity] = [];

    cardIndex[c.set][c.rarity].push(c);
  }
};

const filterCards = (set, rarity, options = {}) => {
  const {
    excludeBasicLands = true,
    isBonusSheet = false
  } = options;

  let pool = cardIndex?.[set]?.[rarity] || [];

  return pool.filter(c => {
    if (excludeBasicLands && c.type_line?.includes("Basic Land")) return false;

    if (c.promo_types?.includes('serialized')) return false;

    if (c.promo_types?.some(p =>
      ['gameday', 'release', 'prerelease'].includes(p)
    )) return false;

    if (isBonusSheet) return true;

    const exemptSets = ['msh', 'spm', 'fin', 'tla'];

    if (!exemptSets.includes(set)) {
      if (c.booster === false && !c.promo_types?.includes('boosterfun')) {
        return false;
      }
    }

    return true;
  });
};

const getWildcard = (set) => {
  const rarity = pickWildcardRarity();
  return (
    getRandom(filterCards(set, rarity)) ||
    getRandom(filterCards(set, 'common'))
  );
};

const generatePack = (mainSet) => {
  const config = setConfigs[mainSet] || { hasBonusSheet: false };

  const commons = filterCards(mainSet, 'common');
  const uncommons = filterCards(mainSet, 'uncommon');
  const rares = filterCards(mainSet, 'rare');
  const mythics = filterCards(mainSet, 'mythic');

  const basicLands = allCards.filter(
    c => c.set === mainSet && c.type_line?.includes("Basic Land")
  );

  if (commons.length === 0) {
    throw new Error(`No cards found for set '${mainSet}'`);
  }

  const pack = [];

  // slot 1-6: common
  for (let i = 0; i < 6; i++) {
    pack.push(getRandom(commons));
  }

  // slot 7: wildcard/bonus
  if (config.hasBonusSheet && roll(config.bonusChance ?? 1)) {
    let rarity = 'uncommon';
    const r = Math.random();

    if (r < 0.066) rarity = 'mythic';
    else if (r < 0.33) rarity = 'rare';

    let bonusPool = filterCards(config.bonusSheet, rarity, {
      excludeBasicLands: false,
      isBonusSheet: true
    });

    if (config.minCollector && config.maxCollector) {
      bonusPool = bonusPool.filter(c => {
        const num = parseInt(c.collector_number);
        return num >= config.minCollector && num <= config.maxCollector;
      });
    }

    pack.push(
      getRandom(bonusPool) || getRandom(commons)
    );

  } else {
    pack.push(getWildcard(mainSet));
  }

  // slot 8-10 uncommon
  for (let i = 0; i < 3; i++) {
    pack.push(getRandom(uncommons));
  }

  // slot 11: rare/mythic
  pack.push(
    roll(1/8) && mythics.length
      ? getRandom(mythics)
      : getRandom(rares)
  );

  // slot 12: foil
  pack.push(getWildcard(mainSet));

  // slot 13: land
  pack.push(
    basicLands.length
      ? getRandom(basicLands)
      : getRandom(commons)
  );

  // slot 14: token
  const tokenSet = 't' + mainSet;
  const tokens = allCards.filter(
    c => c.set === tokenSet || c.layout === 'token'
  );

  pack.push(
    tokens.length
      ? getRandom(tokens)
      : {
          id: 'token-placeholder',
          name: 'Token / Ad Card',
          image_uris: {
            normal:
              'https://cards.scryfall.io/large/front/f/5/f591244f-3760-464a-b501-72996d934bb6.jpg'
          },
          rarity: 'common'
        }
  );

  return pack;
};

// formatter

const formatCard = (c, index, config) => {
  const image =
    c.image_uris?.normal ||
    c.card_faces?.[0]?.image_uris?.normal ||
    '';

  return {
    id: c.id,
    name: c.name,
    set: c.set,
    collector_number: c.collector_number,
    image,
    rarity: c.rarity,
    isFoil: index === 11,
    isBonusSheet:
      config.hasBonusSheet && c.set === config.bonusSheet
  };
};

// route

app.get('/api/open-pack', (req, res) => {
  const mainSet = req.query.set?.toLowerCase().trim();

  if (!mainSet) {
    return res.status(400).json({ error: "Set code required" });
  }

  try {
    const pack = generatePack(mainSet);
    const config = setConfigs[mainSet] || {};

    res.json(pack.map((c, i) => formatCard(c, i, config)));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// loader

console.log("Loading cards into memory...");

const rl = readline.createInterface({
  input: fs.createReadStream('./cards.jsonl'),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  if (!line.trim()) return;

  try {
    allCards.push(JSON.parse(line));
  } catch {  }
});

rl.on('close', () => {
  buildIndex(); 

  console.log(`Loaded ${allCards.length} cards`);

  app.listen(3005, () =>
    console.log('Server running on http://localhost:3005')
  );
});