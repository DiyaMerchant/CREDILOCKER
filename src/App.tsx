import React, { useState, useEffect } from 'react'
import { UserRole, User, Student } from './types'
import { canAccessPage } from './lib/pageAccess'
import RoleSelection from './components/RoleSelection'
import Login from './components/Login'
import Navigation from './components/Navigation'
import LandingPage from './components/LandingPage'
import FieldProject from './components/FieldProject'
import CommunityEngagement from './components/CommunityEngagement'
import CoCurricular from './components/CoCurricular'
import ManageClasses from './components/ManageClasses'
import Attendance from './components/Attendance'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [currentPage, setCurrentPage] = useState('landing')

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
  }, [])

  const handleLogin = (userData: User, userRole: UserRole) => {
    setUser(userData)
    localStorage.setItem('currentUser', JSON.stringify(userData))
    setCurrentPage('landing')
  }

  const handleLogout = () => {
    setUser(null)
    setCurrentPage('landing')
    localStorage.removeItem('currentUser')
    setSelectedRole(null)
  }

  const handleRoleSelect = (selectedRole: UserRole) => {
    setSelectedRole(selectedRole)
  }

  const handleBackToRoleSelection = () => {
    setSelectedRole(null)
  }

  const handlePageChange = (page: string) => {
    if (user && canAccessPage(user, page)) {
      setCurrentPage(page)
    }
  }

  const renderCurrentPage = () => {
    if (user && !canAccessPage(user, currentPage)) {
      setCurrentPage('landing')
      return <LandingPage role={user.role} onPageChange={handlePageChange} user={user} />
    }

    switch (currentPage) {
      case 'landing':
        return <LandingPage role={user!.role} onPageChange={handlePageChange} user={user} />
      case 'field-project':
        return <FieldProject 
          role={user!.role} 
          studentUid={user!.id} 
          studentClass={user!.role === 'student' ? (user!.data as Student).class : ''} 
        />
      case 'community-engagement':
        return <CommunityEngagement role={user!.role} />
      case 'co-curricular':
        return <CoCurricular role={user!.role} />
      case 'manage-classes':
        return <ManageClasses role={user!.role} />
      case 'attendance':
        return <Attendance role={user!.role} />
      default:
        return <LandingPage role={user!.role} onPageChange={handlePageChange} user={user} />
    }
  }

  if (!user) {
    if (!selectedRole) {
      return <RoleSelection onRoleSelect={handleRoleSelect} />
    }
    return (
      <Login 
        onLogin={handleLogin} 
        role={selectedRole} 
        onBack={handleBackToRoleSelection}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f0f0' }}>
      <Navigation
        currentPage={currentPage}
        onPageChange={handlePageChange}
        user={user}
        onLogout={handleLogout}
      />
      <main>
        {renderCurrentPage()}
      </main>
    </div>
  )
}

export default App