import type { Category, Creator, Edition, Nft, Network } from '@/contracts'

/** PRNG determinístico (mulberry32) — fixtures idênticas em toda execução. */
export function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIXED_NOW = Date.parse('2026-10-01T12:00:00.000Z')

export const CREATORS: Creator[] = [
  { id: 'cr-1', name: 'Kurio Studio', avatarUrl: '' },
  { id: 'cr-2', name: 'Ana Verdant', avatarUrl: '' },
  { id: 'cr-3', name: 'Moss & Ember', avatarUrl: '' },
  { id: 'cr-4', name: 'Nomad Lab', avatarUrl: '' },
  { id: 'cr-5', name: 'Ivory Works', avatarUrl: '' },
  { id: 'cr-6', name: 'Signal House', avatarUrl: '' },
]

export const COLLECTIONS = ['Kurio Apes', 'Kurio Editions', 'Nomad Society', 'Golden Hours', 'Neon Vessels', 'Cosmic Garden']

// Os 8 primeiros nomes/preços reproduzem os exemplos do Figma.
const FIGMA_SAMPLES: [string, string][] = [
  ['Emerald Ape', '1.19'],
  ['Sage Nomad', '1.69'],
  ['Neon Vessel', '1.99'],
  ['Cosmic Bloom', '1.29'],
  ['Violet Nomad', '1.39'],
  ['Ivory Baron', '1.79'],
  ['Golden Beat', '0.99'],
  ['Golden Signal', '0.39'],
]
const FIGMA_NUMBERS = [42, 9, 552, 118, 314, 88, 207, 160]
const ADJ = ['Emerald', 'Sage', 'Neon', 'Cosmic', 'Violet', 'Ivory', 'Golden', 'Amber', 'Copper', 'Rust', 'Velvet', 'Lunar']
const NOUN = ['Ape', 'Nomad', 'Vessel', 'Bloom', 'Baron', 'Beat', 'Signal', 'Fox', 'Orbit', 'Echo', 'Prism', 'Voyager']
const CATS: Category[] = ['digital-art', 'photography', 'music', '3d', 'collectibles', 'generative', 'gaming', 'subscriptions', 'utility']
const CHAINS: Network[] = ['ethereum', 'polygon', 'ethereum', 'solana']
const ATTRS = ['Óculos', 'Esmeralda', 'Raro', 'Holográfico', 'Dourado', 'Animado', 'Neon', 'Clássico', 'Edição limitada']
/** Edições do Figma: 1/1, 1/10, 1/50 e ABERTA */
const EDITION_DEFS: { name: string; supply: number; factor: number }[] = [
  { name: '1/1', supply: 1, factor: 3 },
  { name: '1/10', supply: 10, factor: 1.6 },
  { name: '1/50', supply: 50, factor: 1 },
  { name: 'Aberta', supply: 500, factor: 0.5 },
]

// Ilustrações recortadas do Figma (4 personagens) + variações de matiz geradas a partir delas.
const FIGMA_IMAGES = ['glasses', 'bucket', 'black', 'bucket', 'bucket', 'black', 'orange', 'orange']
const ALL_IMAGES = ['glasses', 'bucket', 'black', 'orange'].flatMap((k) => ['a', 'b', 'c'].map((v) => `${k}-${v}`))
function imageFor(i: number) {
  const key = i <= FIGMA_IMAGES.length ? `${FIGMA_IMAGES[i - 1]}-a` : ALL_IMAGES[(i * 5) % ALL_IMAGES.length]
  return `/nfts/${key}.webp`
}

/** NFTs com todas as edições esgotadas (filtro "Esgotados"); fora dos 8 do Figma, usados nos fluxos de compra. */
const SOLD_OUT = new Set([11, 13, 26])

function round4(v: number) {
  return (Math.round(v * 10000) / 10000).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

export function buildNfts(count = 36): Nft[] {
  const r = seeded(20261022)
  const list: Nft[] = []
  for (let i = 1; i <= count; i++) {
    const id = `nft-${String(i).padStart(3, '0')}`
    const sample = FIGMA_SAMPLES[i - 1]
    const number = FIGMA_NUMBERS[i - 1] ?? Math.floor(r() * 900) + 10
    const baseName = sample?.[0] ?? `${ADJ[i % ADJ.length]} ${NOUN[(i * 5) % NOUN.length]}`
    const name = `${baseName} #${String(number).padStart(3, '0')}`
    const basePrice = sample ? Number(sample[1]) : 0.05 + r() * r() * 3
    // 1/50 tem o preço "de vitrine"; demais edições derivam dele
    const editions: Edition[] = EDITION_DEFS.map((def, e) => {
      const soldOut = (i % 9 === 0 && e === 2) || SOLD_OUT.has(i)
      const unavailable = (i === 3 && e === 0) || (i % 7 === 0 && e === 3)
      const random = Math.max(1, Math.min(def.supply, 1 + Math.floor(r() * Math.min(def.supply, 12))))
      // exemplos do Figma: estoque fixo e suficiente para os fluxos de demonstração/testes
      const available = soldOut || unavailable ? 0 : i <= 8 ? Math.min(def.supply, 12) : random
      return {
        id: `${id}-ed-${e + 1}`,
        name: def.name,
        priceEth: round4(basePrice * def.factor),
        available,
        maxPerOrder: def.supply === 1 ? 1 : Math.min(10, def.supply),
        status: unavailable ? 'unavailable' : available === 0 ? 'sold_out' : 'available',
      }
    })
    const img = imageFor(i)
    const collection = i === 1 ? 'Kurio Apes' : COLLECTIONS[i % COLLECTIONS.length]
    const attrs = [ATTRS[i % ATTRS.length], ATTRS[(i * 3 + 1) % ATTRS.length], ATTRS[(i * 7 + 2) % ATTRS.length]]
    const createdDaysAgo = i <= 8 ? i : 9 + Math.floor(r() * 90)
    const nft: Nft = {
      id,
      tokenId: `#${String(number).padStart(4, '0')}`,
      name,
      rarity: i % 5 === 0 ? 'legendary' : i % 3 === 0 || i === 1 ? 'rare' : 'common',
      rating: { average: i === 1 ? 4.8 : Math.round((3.8 + r() * 1.1) * 10) / 10, count: i === 1 ? 19 : 3 + Math.floor(r() * 60) },
      isNew: createdDaysAgo <= 20,
      isTrending: i % 4 === 1 || i <= 3,
      imageUrl: img,
      gallery: [img, img.replace(/-(a|b|c)\.webp$/, '-b.webp'), img.replace(/-(a|b|c)\.webp$/, '-c.webp'), img],
      collection,
      category: i <= 3 ? 'digital-art' : CATS[i % CATS.length],
      creator: CREATORS[i % CREATORS.length],
      description: `${name} é uma obra digital finalizada à mão da coleção ${collection}. Cada edição é verificada na blockchain, com procedência imutável e metadados armazenados no IPFS.`,
      tags: [CATS[i % CATS.length], collection.split(' ')[0].toLowerCase(), 'nft'],
      attributes: [...new Set(attrs)],
      royaltyPercent: 5,
      editions,
      priceEth: '0',
      highestBidEth: '0',
      totalAvailable: 0,
      contractAddress: `0x7a42${(0xabc0000 + i * 7919).toString(16).padStart(32, '0')}19e8`,
      chain: CHAINS[i % CHAINS.length],
      createdAt: new Date(FIXED_NOW - createdDaysAgo * 864e5).toISOString(),
      version: 1,
    }
    list.push(nft)
  }
  return list
}

export interface FixtureUser {
  id: string
  name: string
  username: string
  email: string
  password: string
  bio: string
}

/** Credenciais fictícias documentadas no README. */
export const FIXTURE_USERS: FixtureUser[] = [
  { id: 'usr-ana', name: 'Ana Colecionadora', username: 'anacollects', email: 'ana@nft.test', password: 'Senha@123', bio: 'Colecionadora de arte generativa.' },
  { id: 'usr-bruno', name: 'Bruno Trader', username: 'brunotrades', email: 'bruno@nft.test', password: 'Senha@123', bio: 'Edições raras e música on-chain.' },
]

export interface CouponFixture {
  code: string
  description: string
  percentOff: number
  expiresAt: string
}

export const COUPONS: CouponFixture[] = [
  { code: 'KURIO10', description: 'Desconto do lançamento (10%)', percentOff: 10, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'GENESIS25', description: 'Genesis Drops (25%)', percentOff: 25, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'EXPIRADO20', description: 'Campanha encerrada (20%)', percentOff: 20, expiresAt: '2024-01-01T00:00:00.000Z' },
]
