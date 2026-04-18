/**
 * Fix SimC input strings that have gear items with `drop_level` but no `ilevel`.
 * SimC can't always resolve item level from drop_level alone, causing fatal errors.
 *
 * This adds a fallback `ilevel=1` for such items so SimC doesn't crash.
 * The actual ilevel will be resolved by SimC from the bonus_id data when possible.
 */
export function fixSimcInput(input: string): string {
  return input.replace(
    /^((?:head|neck|shoulder|shoulders|back|chest|wrists|wrist|hands|waist|legs|feet|finger1|finger2|trinket1|trinket2|main_hand|off_hand)=.+)$/gm,
    (line) => {
      // If the line has drop_level but no ilevel, SimC may fail
      if (line.includes('drop_level=') && !line.includes('ilevel=')) {
        // Extract drop_level value and estimate ilevel
        const dropMatch = line.match(/drop_level=(\d+)/)
        if (dropMatch) {
          const dropLevel = parseInt(dropMatch[1], 10)
          // Rough ilvl estimate: in TWW/Midnight, drop_level 90 ≈ ilvl 200-220
          // Use a conservative estimate so SimC has something valid
          const estimatedIlvl = Math.max(1, Math.round(dropLevel * 2.2))
          return `${line},ilevel=${estimatedIlvl}`
        }
      }
      return line
    },
  )
}
