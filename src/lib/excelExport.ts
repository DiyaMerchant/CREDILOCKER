import * as XLSX from 'xlsx'

export interface FPReportRow {
  uid: string
  name: string
  status: string
  marks: number
  credits: number
}

export interface CEPReportRow {
  uid: string
  name: string
  hoursCompleted: number
  creditsAllocated: number
}

export const exportFPReport = (data: FPReportRow[], filename: string = 'field_project_report.xlsx') => {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Field Project Report')
  
  const columnWidths = [
    { wch: 15 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 }
  ]
  ;(worksheet as any)['!cols'] = columnWidths
  
  XLSX.writeFile(workbook, filename)
}


export function exportCEPReport(rows: CEPReportRow[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'CEP Report')
  XLSX.writeFile(workbook, 'CEP_Report.xlsx')
}

export const exportAttendanceReport = (rows: any[][], sheetName: string = 'Attendance', filename: string = 'attendance_report.xlsx') => {
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, filename)
}

