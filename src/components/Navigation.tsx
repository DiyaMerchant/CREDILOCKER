import React from 'react'
import { User, Student, Teacher } from '../types'
import { getAccessiblePages } from '../lib/pageAccess'
import { Toolbar, Button, colors } from './UI'

interface NavigationProps {
  currentPage: string
  onPageChange: (page: string) => void
  user: User
  onLogout: () => void
}

export default function Navigation({ currentPage, onPageChange, user, onLogout }: NavigationProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= 640)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  const pages = [
    { id: 'landing', title: 'Home' },
    { id: 'field-project', title: 'Field Project' },
    { id: 'community-engagement', title: 'Community Engagement' },
    { id: 'co-curricular', title: 'Co-Curricular' },
    { id: 'attendance', title: 'Attendance' },
    { id: 'manage-classes', title: 'Manage Classes' },
  ]

  const accessiblePageIds = getAccessiblePages(user)
  const availablePages = pages.filter(page => accessiblePageIds.includes(page.id))

  return (
    <div style={{ backgroundColor: colors.white }}>
      <Toolbar>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 'clamp(16px, 2.5vw, 18px)', fontWeight: 700, color: colors.primary }}>CrediLocker</div>
          {!isMobile && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: '100%' }}>
              {availablePages.map((page) => (
                <Button key={page.id} variant={currentPage === page.id ? 'primary' : 'secondary'} onClick={() => onPageChange(page.id)}>
                  {page.title}
                </Button>
              ))}
            </div>
          )}
          {isMobile && (
            <Button variant="secondary" onClick={() => setMobileOpen(true)} style={{ marginLeft: 4 }}>Menu</Button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '40%' }}>
          <span style={{ fontSize: 'clamp(12px, 1.8vw, 14px)', color: colors.subtleText, whiteSpace: 'nowrap' }}>
            {user.role === 'student' 
              ? `${(user.data as Student).name} (${(user.data as Student).class})`
              : `${(user.data as Teacher).name}`
            }
          </span>
          <Button variant="danger" onClick={onLogout}>Logout</Button>
        </div>
      </Toolbar>

      {isMobile && mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <div onClick={() => setMobileOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '78vw', maxWidth: 320, background: colors.white, borderRight: `1px solid ${colors.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: colors.primary }}>Menu</div>
              <button onClick={() => setMobileOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>
            {availablePages.map((page) => (
              <Button key={page.id} variant={currentPage === page.id ? 'primary' : 'secondary'} onClick={() => { onPageChange(page.id); setMobileOpen(false) }}>
                {page.title}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}