import regionsData from './Regions.json'

const armModules = import.meta.glob('../assets/arms/*.{png,jpg,jpeg,webp,svg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const transliterationMap: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

const STOP_WORDS = new Set(['oblast', 'kray', 'krai', 'respublika', 'okrug', 'avtonomnyy', 'avtonomnaya'])

const REGION_ARM_OVERRIDES: Record<string, string> = {
  'Липецкая область': 'lipetzkaya-oblast',
  'Чувашская Республика': 'chuvasia',
}

const transliterate = (value: string) =>
  value
    .toLowerCase()
    .split('')
    .map((char) => transliterationMap[char] ?? char)
    .join('')

const normalizeForMatch = (value: string) =>
  transliterate(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

const reduceRegionTokens = (value: string) =>
  normalizeForMatch(value)
    .split(' ')
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token))
    .map((token) => token.replace(/(skiy|skaya|skoye|ski|skij|sky|aya)$/g, ''))
    .filter(Boolean)
    .join(' ')

const stemToSrc = new Map(
  Object.entries(armModules).map(([path, src]) => {
    const fileName = path.split('/').pop() ?? path
    const stem = fileName.replace(/\.[^.]+$/, '')

    return [stem.toLowerCase(), src]
  }),
)

const guessArmStem = (regionName: string) => {
  const normalized = normalizeForMatch(regionName)
  const reduced = reduceRegionTokens(regionName)

  return (
    REGION_ARM_OVERRIDES[regionName] ??
    Array.from(stemToSrc.keys()).find((stem) => stem === normalized || stem.includes(normalized) || normalized.includes(stem)) ??
    Array.from(stemToSrc.keys()).find((stem) => stem === reduced || stem.includes(reduced) || reduced.includes(stem)) ??
    normalized.replace(/\s+/g, '-')
  )
}

export const REGION_ARM_ALIASES: Record<string, string> = Object.fromEntries(
  Object.keys(regionsData).map((regionName) => [regionName, guessArmStem(regionName)]),
)

export const resolveRegionArmSrc = (regionName: string) => {
  const stem = REGION_ARM_ALIASES[regionName]

  if (!stem) {
    return null
  }

  return stemToSrc.get(stem.toLowerCase()) ?? null
}