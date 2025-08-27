import { supabase } from './supabase'
import { UserRole, Student, Teacher, User } from '../types'
import { verifyPassword } from './password'

export const authenticateUser = async (
  credentials: { uid?: string; email?: string; password?: string },
  role: UserRole
): Promise<User | null> => {
  try {
    if (role === 'student') {
      if (!credentials.uid || !credentials.email) {
        throw new Error('UID and email are required for student login')
      }

      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('uid', credentials.uid)
        .eq('email', credentials.email)
        .single()

      if (error || !data) {
        throw new Error('Invalid student credentials')
      }

      return {
        id: data.uid,
        role: 'student',
        data: data as Student
      }
    } else {
      if (!credentials.email || !credentials.password) {
        throw new Error('Email and password are required for teacher login')
      }

      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('email', credentials.email)
        .single()

      if (error || !data) {
        throw new Error('Invalid teacher credentials')
      }

      // Compare password using PBKDF2 (with plaintext fallback for legacy rows)
      const ok = await verifyPassword(credentials.password, (data as any).password || '')
      if (!ok) {
        throw new Error('Invalid teacher credentials')
      }

      return {
        id: data.employee_code,
        role: 'teacher',
        data: data as Teacher
      }
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return null
  }
}