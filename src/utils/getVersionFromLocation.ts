export default function getVersionFromLocation (versionStatements: RegExpMatchArray[], start: number) : string {
  for (let i = 0; i < versionStatements.length; i++) {
    const next = versionStatements[i + 1]
    if (!next || next.index! > start) {
      return versionStatements[i][1]
    }
  }
  return '0.0.0'
}
