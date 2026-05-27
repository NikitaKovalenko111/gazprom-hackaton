const renderModules = import.meta.glob('./renders/*', {
  eager: true,
  import: 'default',
}) as Record<string, string>

export interface RegionRenderAsset {
  src: string
  title: string
  viewIndex: number
}

const normalizeText = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .replace(/\s+\./g, '.')
    .trim()
    .toLowerCase()

const stripExtension = (fileName: string) => fileName.replace(/\.[^.]+$/, '').trim()

const parseRenderFileName = (fileName: string) => {
  const baseName = stripExtension(fileName)
  const match = baseName.match(/^(.*?)(?:\s+вид\s*(\d+))\s*$/i)

  if (!match) {
    return null
  }

  const regionName = match[1].trim()
  const viewIndex = Number(match[2])

  if (!regionName || Number.isNaN(viewIndex)) {
    return null
  }

  return { regionName, viewIndex }
}

export const getRegionRenderAssets = (regionName: string): RegionRenderAsset[] => {
  const normalizedRegionName = normalizeText(regionName)

  return Object.entries(renderModules)
    .map(([path, src]) => {
      const fileName = path.split('/').pop() ?? path
      const parsed = parseRenderFileName(fileName)

      if (!parsed) {
        return null
      }

      if (normalizeText(parsed.regionName) !== normalizedRegionName) {
        return null
      }

      return {
        src,
        title: `${parsed.regionName} вид ${parsed.viewIndex}`,
        viewIndex: parsed.viewIndex,
      }
    })
    .filter((item): item is RegionRenderAsset => item !== null)
    .sort((left, right) => left.viewIndex - right.viewIndex)
}