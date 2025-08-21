import React from 'react'
import { UserRole } from '../types'

interface RoleSelectionProps {
  onRoleSelect: (role: UserRole) => void
}

export default function RoleSelection({ onRoleSelect }: RoleSelectionProps) {
  return (
    <div style={{ 
      height: '100vh', 
      backgroundColor: '#f0f0f0', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center' 
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '30px', 
        borderRadius: '5px', 
        width: '400px',
        textAlign: 'center',
        border: '1px solid #ccc'
      }}>
        <h1 style={{ fontSize: '28px', marginBottom: '10px' }}>CrediLocker</h1>
        <p style={{ color: '#666', marginBottom: '30px' }}>Choose your role</p>
        
        <button
          onClick={() => onRoleSelect('student')}
          style={{
            width: '100%',
            padding: '20px',
            marginBottom: '15px',
            border: '2px solid #ddd',
            borderRadius: '5px',
            backgroundColor: 'white',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>Student</div>
          <div style={{ color: '#666', fontSize: '14px' }}>
            Track your projects and activities
          </div>
        </button>

        <button
          onClick={() => onRoleSelect('teacher')}
          style={{
            width: '100%',
            padding: '20px',
            border: '2px solid #ddd',
            borderRadius: '5px',
            backgroundColor: 'white',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>Teacher</div>
          <div style={{ color: '#666', fontSize: '14px' }}>
            Manage projects and student activities
          </div>
        </button>
      </div>
    </div>
  )
}