import React, { useState } from 'react'
import { authenticateUser } from '../lib/auth'
import { UserRole } from '../types'

interface LoginProps {
  onLogin: (user: any, role: UserRole) => void
  role: UserRole
  onBack: () => void
}

export default function Login({ onLogin, role, onBack }: LoginProps) {
  const [uid, setUid] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const credentials = role === 'student' 
        ? { uid, email }
        : { email, password }

      const user = await authenticateUser(credentials, role)

      if (user) {
        onLogin(user, role)
      } else {
        alert('Login failed. Please check your credentials.')
      }
    } catch (error) {
      alert('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
        border: '1px solid #ccc'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={onBack}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              marginRight: '10px'
            }}
          >
            ← Back
          </button>
          <span style={{ fontSize: '24px', fontWeight: 'bold' }}>CrediLocker</span>
        </div>
        
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <p style={{ color: '#666' }}>
            Sign in as <strong>{role}</strong>
          </p>
        </div>
        
        <form onSubmit={handleLogin}>
          {role === 'student' ? (
            <>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Student ID
                </label>
                <input
                  type="text"
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '3px',
                    fontSize: '16px'
                  }}
                  placeholder="Enter your student ID"
                  required
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '3px',
                    fontSize: '16px'
                  }}
                  placeholder="Enter your email"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '3px',
                    fontSize: '16px'
                  }}
                  placeholder="Enter your email"
                  required
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '3px',
                    fontSize: '16px'
                  }}
                  placeholder="Enter your password"
                  required
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: '#007bff',
              color: 'white',
              padding: '12px',
              border: 'none',
              borderRadius: '3px',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}