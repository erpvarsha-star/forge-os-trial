/**
 * Forge OS — amount in words, Indian numbering (lakh / crore).
 * amountInWords(28400) -> 'Rupees Twenty Eight Thousand Four Hundred Only'
 * amountInWords(1.5)   -> 'Rupees One and Fifty Paise Only'
 * Amounts are rounded to paise first. Pure function, no I/O.
 */

const ONES = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function below100(n: number): string {
  if (n < 20) return ONES[n]
  const t = TENS[Math.floor(n / 10)]
  return n % 10 ? `${t} ${ONES[n % 10]}` : t
}

function below1000(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  const parts: string[] = []
  if (h) parts.push(`${ONES[h]} Hundred`)
  if (r) parts.push(below100(r))
  return parts.join(' ')
}

/** Whole number (>= 0) to Indian-system words. 0 -> 'Zero'. */
export function integerInWords(n: number): string {
  n = Math.floor(n)
  if (n === 0) return 'Zero'
  const units: [number, string][] = [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand']]
  const parts: string[] = []
  let rest = n
  for (const [size, name] of units) {
    const q = Math.floor(rest / size)
    if (q) {
      // Crore can itself exceed 99 (e.g. 100 crore) — recurse for that part.
      parts.push(`${size === 10000000 ? integerInWords(q) : below100(q)} ${name}`)
      rest -= q * size
    }
  }
  if (rest) parts.push(below1000(rest))
  return parts.join(' ')
}

export function amountInWords(amount: number | null | undefined): string {
  const a = Number(amount ?? 0)
  if (!Number.isFinite(a)) return ''
  const neg = a < 0
  const totalPaise = Math.round(Math.abs(a) * 100)
  const rupees = Math.floor(totalPaise / 100)
  const paise = totalPaise % 100
  let s = `Rupees ${integerInWords(rupees)}`
  if (paise) s += ` and ${below100(paise)} Paise`
  return `${neg ? 'Minus ' : ''}${s} Only`
}
