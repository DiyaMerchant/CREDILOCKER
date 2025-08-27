// Dependency-free password hashing using Web Crypto API (PBKDF2-SHA-256)
// Stored format: pbkdf2:<iterations>:<base64_salt>:<base64_hash>

const ITERATIONS = 100000
const KEY_LEN_BYTES = 32

function toBase64(arr: ArrayBuffer): string {
  const bytes = new Uint8Array(arr)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    keyMaterial,
    KEY_LEN_BYTES * 8
  )
  return bits
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derived = await pbkdf2(password, salt, ITERATIONS)
  return `pbkdf2:${ITERATIONS}:${toBase64(salt)}:${toBase64(derived)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false
  if (!stored.startsWith('pbkdf2:')) {
    // Backwards compatibility: plaintext fallback
    return password === stored
  }
  try {
    const [, iterStr, saltB64, hashB64] = stored.split(':')
    const iterations = parseInt(iterStr, 10)
    const salt = fromBase64(saltB64)
    const derived = await pbkdf2(password, salt, iterations)
    const derivedB64 = toBase64(derived)
    return derivedB64 === hashB64
  } catch {
    return false
  }
}


