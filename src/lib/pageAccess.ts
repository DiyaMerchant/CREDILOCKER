import { Student, Teacher, UserRole } from '../types'

export const getAccessiblePages = (user: { role: UserRole; data: Student | Teacher }): string[] => {
  if (user.role === 'teacher') {
    // Teachers have access to all pages
    return ['landing', 'field-project', 'community-engagement', 'co-curricular', 'attendance', 'manage-classes']
  }

  const student = user.data as Student
  const studentClass = student.class
  const semester = student.semester

  // FYIT and FYSD students can only view co-curricular (attendance is embedded there)
  if (studentClass === 'FYIT' || studentClass === 'FYSD') {
    return ['landing', 'co-curricular']
  }

  // SYIT and SYSD students - access depends on semester
  if (studentClass === 'SYIT' || studentClass === 'SYSD') {
    if (semester === 3) {
      return ['landing', 'field-project', 'co-curricular', 'community-engagement']
    } else if (semester === 4) {
      return ['landing', 'community-engagement', 'co-curricular']
    }
  }

  // Default fallback - only landing and co-curricular
  return ['landing', 'co-curricular']
}

export const canAccessPage = (user: { role: UserRole; data: Student | Teacher }, page: string): boolean => {
  const accessiblePages = getAccessiblePages(user)
  return accessiblePages.includes(page)
}