export const DEFAULT_ACCENT = '#39ff14'

export const PRESETS: { name: string; hex: string }[] = [
  { name: 'phosphor', hex: '#39ff14' },
  { name: 'mint', hex: '#3dffb0' },
  { name: 'cyan', hex: '#00e5ff' },
  { name: 'ice', hex: '#8ab4ff' },
  { name: 'violet', hex: '#b18cff' },
  { name: 'magenta', hex: '#ff4fd8' },
  { name: 'red', hex: '#ff4b4b' },
  { name: 'amber', hex: '#ffb000' },
  { name: 'mono', hex: '#e6e6e6' },
]

export const isHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s)

export function applyAccent(hex: string) {
  const color = isHex(hex) ? hex : DEFAULT_ACCENT
  document.documentElement.style.setProperty('--accent', color)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#06090a"/><path d="M8 10.5 13.5 16 8 21.5" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="16" y="20" width="8" height="2.6" rx="1.3" fill="${color}"/></svg>`
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (link) link.href = 'data:image/svg+xml,' + encodeURIComponent(svg)
}

export const openThemePicker = () => window.dispatchEvent(new Event('tb:theme-picker'))
