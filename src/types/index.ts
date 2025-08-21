export type UserRole = 'student' | 'teacher'

export interface Student {
  uid: string
  email: string
  phone_number?: string
  name: string
  class: string
  semester?: number
}

export interface Teacher {
  employee_code: string
  email: string
  name: string
}

export interface User {
  id: string
  role: UserRole
  data: Student | Teacher
}