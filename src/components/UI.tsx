import React from 'react'

export const colors = {
  primary: getComputedStyle(document.documentElement).getPropertyValue('--primary')?.trim() || '#003F86',
  primaryDark: getComputedStyle(document.documentElement).getPropertyValue('--primary-dark')?.trim() || '#00336c',
  success: getComputedStyle(document.documentElement).getPropertyValue('--success')?.trim() || '#27a376',
  danger: getComputedStyle(document.documentElement).getPropertyValue('--danger')?.trim() || '#d64545',
  warning: getComputedStyle(document.documentElement).getPropertyValue('--warning')?.trim() || '#f8b400',
  text: getComputedStyle(document.documentElement).getPropertyValue('--text')?.trim() || '#1f2937',
  subtleText: getComputedStyle(document.documentElement).getPropertyValue('--subtle-text')?.trim() || '#6b7280',
  border: getComputedStyle(document.documentElement).getPropertyValue('--border')?.trim() || '#e5e7eb',
  bg: getComputedStyle(document.documentElement).getPropertyValue('--bg')?.trim() || '#f7f9fc',
  white: getComputedStyle(document.documentElement).getPropertyValue('--white')?.trim() || '#ffffff'
}

export const Card: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties; className?: string }>> = ({ children, style }) => (
  <div style={{
    backgroundColor: colors.white,
    border: `1px solid ${colors.border}`,
    borderRadius: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--radius')) || 10,
    boxShadow: '0 8px 24px rgba(0, 63, 134, 0.06)',
    padding: 18,
    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    ...style
  }}>
    {children}
  </div>
)

type ButtonType = 'button' | 'submit' | 'reset'

export const Button: React.FC<React.PropsWithChildren<{ variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'; onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; disabled?: boolean; style?: React.CSSProperties; type?: ButtonType }>> = ({ children, variant = 'primary', onClick, disabled, style, type }) => {
  const palette: Record<string, { bg: string; color: string; border: string; hoverBg: string; hoverColor: string }> = {
    primary: { bg: colors.primary, color: colors.white, border: colors.primary, hoverBg: colors.primaryDark, hoverColor: colors.white },
    success: { bg: colors.success, color: colors.white, border: colors.success, hoverBg: '#1f7a35', hoverColor: colors.white },
    danger: { bg: colors.danger, color: colors.white, border: colors.danger, hoverBg: '#bb2d3b', hoverColor: colors.white },
    secondary: { bg: colors.white, color: colors.text, border: colors.border, hoverBg: '#eef2f6', hoverColor: colors.text },
    ghost: { bg: 'transparent', color: colors.text, border: 'transparent', hoverBg: '#eef2f6', hoverColor: colors.text }
  }
  const p = palette[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        backgroundColor: p.bg,
        color: p.color,
        border: `1px solid ${p.border}`,
        padding: '9px 14px',
        borderRadius: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--radius')) || 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 14,
        fontWeight: 600,
        transition: 'background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
        ...style
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = p.hoverBg; (e.currentTarget as HTMLButtonElement).style.color = p.hoverColor }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = p.bg; (e.currentTarget as HTMLButtonElement).style.color = p.color }}
    >
      {children}
    </button>
  )
}

export const Toolbar: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>> = ({ children, style }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    backgroundColor: colors.white,
    borderBottom: `1px solid ${colors.border}`,
    boxShadow: '0 8px 24px rgba(0,63,134,0.05)',
    padding: '0 20px',
    ...style
  }}>
    {children}
  </div>
)

export const Section: React.FC<React.PropsWithChildren<{ title?: string; style?: React.CSSProperties }>> = ({ title, children, style }) => (
  <Card style={{ marginBottom: 16, ...style }}>
    {title && <h3 style={{ marginTop: 0, marginBottom: 14, fontSize: 18, color: colors.text, letterSpacing: 0.2 }}>{title}</h3>}
    {children}
  </Card>
)

export const Modal: React.FC<{ open: boolean; onClose: () => void; title?: string; children: React.ReactNode; width?: number; height?: number; noScroll?: boolean }> = ({ open, onClose, title, children, width = 900, height = 600, noScroll = false }) => {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: colors.white, width, maxWidth: '90vw', height, maxHeight: '85vh', borderRadius: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--radius')) || 10, boxShadow: '0 24px 64px rgba(0,63,134,0.12)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: 12, overflow: noScroll ? 'hidden' : 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}
