export default function getPositionFromLocation (source: string, loc: number) : { line: number, column: number } {
  const lines = source.slice(0, loc).split('\n')
  const line = lines.length
  const column = lines[lines.length - 1].length + 1
  return { line, column }
}
