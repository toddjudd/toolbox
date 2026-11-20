import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export type Tool = {
  id: string
  name: string
  glyph: string
  desc: string
  keywords: string
  Component: LazyExoticComponent<ComponentType>
}

export const TOOLS: Tool[] = [
  {
    id: 'json',
    name: 'JSON',
    glyph: '{}',
    desc: 'Format, minify, validate, explore as a tree',
    keywords: 'json format pretty prettify minify validate lint tree path beautify',
    Component: lazy(() => import('./JsonTool')),
  },
  {
    id: 'jwt',
    name: 'JWT',
    glyph: '⚿',
    desc: 'Decode tokens, check expiry, verify signatures',
    keywords: 'jwt token bearer decode verify claims exp oauth oidc jws',
    Component: lazy(() => import('./JwtTool')),
  },
  {
    id: 'url',
    name: 'URL',
    glyph: '%',
    desc: 'Encode/decode, parse & edit query strings',
    keywords: 'url uri encode decode percent query string params parse',
    Component: lazy(() => import('./UrlTool')),
  },
  {
    id: 'base64',
    name: 'Base64',
    glyph: '64',
    desc: 'Text & files ↔ base64 / base64url',
    keywords: 'base64 b64 encode decode base64url data uri file image atob btoa',
    Component: lazy(() => import('./Base64Tool')),
  },
  {
    id: 'unicode',
    name: 'Unicode',
    glyph: 'U+',
    desc: 'Inspect characters, find invisible junk, clean text',
    keywords: 'unicode character checker inspect invisible zero width bom nbsp smart quotes utf8 bytes hex binary homoglyph clean',
    Component: lazy(() => import('./UnicodeTool')),
  },
  {
    id: 'regex',
    name: 'Regex',
    glyph: '.*',
    desc: 'Live tester, groups, replace, explainer',
    keywords: 'regex regexp regular expression test match replace pattern',
    Component: lazy(() => import('./RegexTool')),
  },
  {
    id: 'epoch',
    name: 'Epoch',
    glyph: '◷',
    desc: 'Unix timestamps ↔ dates across time zones',
    keywords: 'epoch unix timestamp time date timezone iso 8601 utc convert',
    Component: lazy(() => import('./EpochTool')),
  },
  {
    id: 'uuid',
    name: 'UUID',
    glyph: '#',
    desc: 'Generate v4 / v7 / ULID / nanoid, inspect IDs',
    keywords: 'uuid guid ulid nanoid generate id random v4 v7',
    Component: lazy(() => import('./UuidTool')),
  },
  {
    id: 'base',
    name: 'Base / Bits',
    glyph: '0x',
    desc: 'Number bases, bit flipping, bytes ↔ text',
    keywords: 'hex binary decimal octal base convert bits bytes radix twos complement',
    Component: lazy(() => import('./BaseTool')),
  },
  {
    id: 'duration',
    name: 'Duration',
    glyph: 'Δt',
    desc: 'How long is 600000? ms/s/ns → human time, TTLs, ISO 8601',
    keywords: 'duration time span length ttl timeout interval elapsed milliseconds seconds nanoseconds minutes hours days human readable iso 8601 go timespan convert how long',
    Component: lazy(() => import('./DurationTool')),
  },
]

export const toolById = (id: string) => TOOLS.find((t) => t.id === id)
