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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: colors.primary }}>CrediLocker</div>
          <div>
            {availablePages.map((page) => (
              <Button key={page.id} variant={currentPage === page.id ? 'primary' : 'secondary'} onClick={() => onPageChange(page.id)} style={{ marginRight: 8 }}>
                {page.title}
              </Button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, color: colors.subtleText }}>
            {user.role === 'student' 
              ? `${(user.data as Student).name} (${(user.data as Student).class})`
              : `${(user.data as Teacher).name}`
            }
          </span>
          <Button variant="danger" onClick={onLogout}>Logout</Button>
        </div>
      </Toolbar>
    </div>
  )
}