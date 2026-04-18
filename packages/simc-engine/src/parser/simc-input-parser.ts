import type { BagItem, Character, GearItem, GearSlot, WowClass } from '@wow-simc/shared';
import { GearSlot as GearSlotEnum } from '@wow-simc/shared';

/**
 * Known gear slot keywords that appear as line prefixes in SimC addon output.
 */
const GEAR_SLOTS: ReadonlySet<string> = new Set(Object.values(GearSlotEnum));

/**
 * Extended set of gear slot keywords that also covers alternate spellings used
 * by some versions of the SimC addon (shoulder, wrist).
 */
const BAG_GEAR_SLOTS: ReadonlySet<string> = new Set([
  ...Object.values(GearSlotEnum),
  'shoulder',
  'wrist',
]);

/**
 * Normalize alternate slot spellings to the canonical GearSlot value.
 */
function normalizeSlot(slot: string): string {
  if (slot === 'shoulder') return GearSlotEnum.Shoulders;
  if (slot === 'wrist') return GearSlotEnum.Wrists;
  return slot;
}

/**
 * Map SimC class strings (e.g. `warrior`) to WowClass values.
 * SimC uses the class name as the key in the profile string.
 */
// Map all known SimC class key variants to the canonical WowClass name
const SIMC_CLASS_MAP: Record<string, string> = {
  death_knight: 'death_knight',
  deathknight: 'death_knight',
  demon_hunter: 'demon_hunter',
  demonhunter: 'demon_hunter',
  druid: 'druid',
  evoker: 'evoker',
  hunter: 'hunter',
  mage: 'mage',
  monk: 'monk',
  paladin: 'paladin',
  priest: 'priest',
  rogue: 'rogue',
  shaman: 'shaman',
  warlock: 'warlock',
  warrior: 'warrior',
};

/**
 * Parse a gear item line from a SimC addon string.
 *
 * Example line:
 *   head=,id=123456,bonus_id=1234/5678,ilevel=639,enchant_id=1234,gem_id=123/456
 *
 * The slot name is the key before `=`. The rest is a comma-separated list of
 * key=value pairs. The first value after `=` is empty (the slot label itself).
 */
function parseGearLine(slot: string, rest: string): GearItem {
  // rest starts with `,id=...` or `id=...`
  const paramStr = rest.startsWith(',') ? rest.slice(1) : rest;
  const params = new Map<string, string>();

  for (const part of paramStr.split(',')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const value = part.slice(eqIdx + 1).trim();
    params.set(key, value);
  }

  const id = parseInt(params.get('id') ?? '0', 10);
  const ilevel = parseInt(params.get('ilevel') ?? '0', 10);
  const enchant_id = params.has('enchant_id')
    ? parseInt(params.get('enchant_id')!, 10)
    : undefined;

  const gem_ids = params.has('gem_id')
    ? params
        .get('gem_id')!
        .split('/')
        .map((g) => parseInt(g, 10))
        .filter((n) => !isNaN(n) && n > 0)
    : undefined;

  const bonus_ids = params.has('bonus_id')
    ? params
        .get('bonus_id')!
        .split('/')
        .map((b) => parseInt(b, 10))
        .filter((n) => !isNaN(n))
    : undefined;

  return {
    id,
    name: `${slot}_${id}`,
    item_level: ilevel,
    slot: slot as GearSlot,
    ...(enchant_id !== undefined && enchant_id > 0 ? { enchant_id } : {}),
    ...(gem_ids && gem_ids.length > 0 ? { gem_ids } : {}),
    ...(bonus_ids && bonus_ids.length > 0 ? { bonus_ids } : {}),
  };
}

/**
 * Parse a SimulationCraft /simc addon export string into a partial Character.
 *
 * The addon output looks like:
 * ```
 * warrior="CharName"
 * level=80
 * race=human
 * region=us
 * server=ragnaros
 * role=attack
 * professions=...
 * spec=fury
 * talents=...
 * head=,id=123456,bonus_id=1234/5678,ilevel=639,enchant_id=1234,gem_id=123/456
 * neck=,id=234567,...
 * ...
 * ```
 */
export function parseSimcString(input: string): Partial<Character> {
  const result: Partial<Character> = {};
  const gear: Partial<Record<GearSlot, GearItem | null>> = {};

  // Preserve the full input as simc_string
  result.simc_string = input.trim();

  const lines = input.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim().toLowerCase();
    const value = line.slice(eqIdx + 1).trim();

    // Class + character name: warrior="CharName" or deathknight="CharName"
    const canonicalClass = SIMC_CLASS_MAP[key];
    if (canonicalClass) {
      result.class = canonicalClass as WowClass;
      // Remove surrounding quotes if present
      result.name = value.replace(/^["']|["']$/g, '');
      continue;
    }

    switch (key) {
      case 'level':
        result.level = parseInt(value, 10);
        break;

      case 'race':
        result.race = value;
        break;

      case 'region':
        // Region type is a union of known strings; cast narrowly
        result.region = value as Character['region'];
        break;

      case 'server':
        result.realm = value;
        break;

      case 'spec':
        result.spec = value;
        break;

      case 'talents':
        result.talents = value;
        break;

      default:
        // Check for gear slot lines (support alternate spellings like shoulder/wrist)
        if (GEAR_SLOTS.has(key) || BAG_GEAR_SLOTS.has(key)) {
          const normalizedKey = normalizeSlot(key);
          const item = parseGearLine(normalizedKey, value);
          gear[normalizedKey as GearSlot] = item;
        }
        break;
    }
  }

  // Attach gear if any slots were parsed
  if (Object.keys(gear).length > 0) {
    // Fill missing slots with null to satisfy the full Record type
    const fullGear = Object.fromEntries(
      Object.values(GearSlotEnum).map((slot) => [slot, gear[slot] ?? null]),
    ) as Record<GearSlot, GearItem | null>;

    result.gear = fullGear;

    // Derive average item level from parsed items
    const items = Object.values(fullGear).filter(
      (item): item is GearItem => item !== null,
    );
    if (items.length > 0) {
      const totalIlvl = items.reduce((sum, item) => sum + item.item_level, 0);
      result.item_level = Math.round(totalIlvl / items.length);
    }
  }

  return result;
}

/**
 * Parse commented-out gear lines from a SimC addon export string and return
 * them as BagItem objects.
 *
 * The addon appends items in the player's bags as comment lines, e.g.:
 * ```
 * ### Gear from Bags
 * # head=,id=212345,bonus_id=1/2/3,ilevel=639
 * # neck=spellsnap_shadowmask,id=212346,bonus_id=4/5,ilevel=639,gem_id=123
 * ```
 */
export function parseBagItems(input: string): BagItem[] {
  const results: BagItem[] = [];
  const lines = input.split(/\r?\n/);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    // Must start with '#'
    if (!trimmed.startsWith('#')) continue;

    // Strip the leading '#' and optional whitespace
    const inner = trimmed.slice(1).trim();

    // Skip pure-comment lines (e.g. "### Gear from Bags")
    if (!inner || inner.startsWith('#')) continue;

    // Must contain '=' to be a key=value line
    const eqIdx = inner.indexOf('=');
    if (eqIdx === -1) continue;

    const key = inner.slice(0, eqIdx).trim().toLowerCase();
    const rest = inner.slice(eqIdx + 1); // everything after the first '='

    if (!BAG_GEAR_SLOTS.has(key)) continue;

    const slot = normalizeSlot(key);

    // The value may start with a name or be empty: `head=,id=...` or `head=name,id=...`
    const paramStr = rest.startsWith(',') ? rest.slice(1) : rest;
    const params = new Map<string, string>();

    // The first segment before a comma may be the item name (no key= prefix)
    const segments = paramStr.split(',');
    let itemName = '';
    let startIdx = 0;

    // If the first segment has no '=' it is the item name
    if (segments.length > 0 && !segments[0].includes('=')) {
      itemName = segments[0].trim();
      startIdx = 1;
    }

    for (let i = startIdx; i < segments.length; i++) {
      const part = segments[i];
      const pEqIdx = part.indexOf('=');
      if (pEqIdx === -1) continue;
      const k = part.slice(0, pEqIdx).trim();
      const v = part.slice(pEqIdx + 1).trim();
      params.set(k, v);
    }

    const id = parseInt(params.get('id') ?? '0', 10);
    if (!id) continue; // skip lines without a valid id

    const ilevel = parseInt(params.get('ilevel') ?? '0', 10);

    const enchant_id = params.has('enchant_id')
      ? parseInt(params.get('enchant_id')!, 10)
      : undefined;

    const gem_ids = params.has('gem_id')
      ? params
          .get('gem_id')!
          .split('/')
          .map((g) => parseInt(g, 10))
          .filter((n) => !isNaN(n) && n > 0)
      : undefined;

    const bonus_ids = params.has('bonus_id')
      ? params
          .get('bonus_id')!
          .split('/')
          .map((b) => parseInt(b, 10))
          .filter((n) => !isNaN(n))
      : undefined;

    // Reconstruct the canonical simc line (without the '#' prefix)
    const encoded_line = inner;

    const name = itemName || `${slot}_${id}`;

    results.push({
      slot,
      id,
      name,
      item_level: ilevel,
      encoded_line,
      ...(enchant_id !== undefined && enchant_id > 0 ? { enchant_id } : {}),
      ...(gem_ids && gem_ids.length > 0 ? { gem_ids } : {}),
      ...(bonus_ids && bonus_ids.length > 0 ? { bonus_ids } : {}),
    });
  }

  return results;
}
