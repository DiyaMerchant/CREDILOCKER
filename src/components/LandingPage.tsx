import React from 'react'
import { UserRole, User, Student } from '../types'
import { supabase } from '../lib/supabase'
import { Card, Section, colors } from './UI'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, Legend } from 'recharts'
import { exportAttendanceReport as exportAttendanceSheet, exportCEPReport, exportFPReport } from '../lib/excelExport'

interface LandingPageProps {
  role: UserRole
  onPageChange: (page: string) => void
  user?: User
}

export default function LandingPage({ role, user }: LandingPageProps) {
  // Dashboard states
  const [studentsWithAllDocs, setStudentsWithAllDocs] = React.useState(0)
  const [studentsWithAllDocsToday, setStudentsWithAllDocsToday] = React.useState(0)
  const [cepUniqueStudents, setCepUniqueStudents] = React.useState(0)
  const [cepUniqueStudentsToday, setCepUniqueStudentsToday] = React.useState(0)
  const [teacherAttendanceToday, setTeacherAttendanceToday] = React.useState(0)
  const [cepDaily, setCepDaily] = React.useState<{ date: string; count: number }[]>([])
  // removed unused attendanceDaily state
  const [upcomingActivities, setUpcomingActivities] = React.useState<any[]>([])
  const [activityOptions, setActivityOptions] = React.useState<{ id: number; date: string; name: string }[]>([])
  const [selectedActivityId, setSelectedActivityId] = React.useState<string>('')
  const [attendanceCountsBySelected, setAttendanceCountsBySelected] = React.useState<{ present: number; absent: number }>({ present: 0, absent: 0 })

  // Student dashboard states
  const [fieldCounts, setFieldCounts] = React.useState<{ [k: string]: number }>({})
  const [upcomingCCCount, setUpcomingCCCount] = React.useState(0)
  const [attendanceStats, setAttendanceStats] = React.useState({ present: 0, absent: 0 })
  const [cepProgress, setCepProgress] = React.useState(0)
  const [cepRequirement, setCepRequirement] = React.useState<any>(null)

  React.useEffect(() => {
    if (!user) return
    if (role === 'student') {
      fetchStudentDashboard()
    } else {
      fetchTeacherDashboard()
    }
    // eslint-disable-next-line
  }, [role, user])

  // --- Student Dashboard Data ---
  const fetchStudentDashboard = async () => {
    const studentClass = (user?.data as Student)?.class
    // Field Project
    const { data: fpData } = await supabase
      .from('field_project_submissions')
      .select('document_type')
      .eq('student_uid', user?.id)
    const counts: { [k: string]: number } = {}
    ; (fpData || []).forEach((r: any) => {
      counts[r.document_type] = (counts[r.document_type] || 0) + 1
    })
    setFieldCounts(counts)
    // Upcoming CC
    const today = new Date().toISOString().slice(0, 10)
    const { data: ccData } = await supabase
      .from('co_curricular_activities')
      .select('id, assigned_class, date')
      .gte('date', today)
      .contains('assigned_class', [studentClass] as any)
    setUpcomingCCCount((ccData || []).length)
    // Attendance
    const { data: attData } = await supabase
      .from('co_curricular_attendance')
      .select('attendance_status')
      .eq('student_uid', user?.id)
    setAttendanceStats({
      present: (attData || []).filter((r: any) => r.attendance_status === 'present').length,
      absent: (attData || []).filter((r: any) => r.attendance_status === 'absent').length
    })
    // CEP Progress
    const { data: reqData } = await supabase
      .from('cep_requirements')
      .select('*')
      .eq('assigned_class', studentClass)
    if (reqData && reqData.length > 0) {
      setCepRequirement(reqData[0])
      const { data: subData } = await supabase
        .from('cep_submissions')
        .select('hours')
        .eq('student_uid', user?.id)
      const totalHours = subData?.reduce((sum, sub) => sum + sub.hours, 0) || 0
      setCepProgress(Math.min((totalHours / reqData[0].minimum_hours) * 100, 100))
    }
  }

  // --- Teacher Dashboard Data ---
  const fetchTeacherDashboard = async () => {
    // Field Project
    const { data: submissions } = await supabase
      .from('field_project_submissions')
      .select('student_uid, document_type, uploaded_at')
    const studentDocs: { [uid: string]: { types: Set<string>, latestUpload: string } } = {}
    ; (submissions || []).forEach((sub: any) => {
      if (!studentDocs[sub.student_uid]) {
        studentDocs[sub.student_uid] = { types: new Set(), latestUpload: '' }
      }
      studentDocs[sub.student_uid].types.add(sub.document_type)
      if (!studentDocs[sub.student_uid].latestUpload || new Date(sub.uploaded_at) > new Date(studentDocs[sub.student_uid].latestUpload)) {
        studentDocs[sub.student_uid].latestUpload = sub.uploaded_at
      }
    })
    const requiredTypes = new Set(['completion_letter', 'outcome_form', 'feedback_form', 'video_presentation'])
    let allDocsCount = 0, allDocsTodayCount = 0
    const todayStr = new Date().toISOString().slice(0, 10)
    Object.values(studentDocs).forEach(({ types, latestUpload }) => {
      if (requiredTypes.size === types.size && [...requiredTypes].every(t => types.has(t))) {
        allDocsCount++
        if (latestUpload && latestUpload.slice(0, 10) === todayStr) allDocsTodayCount++
      }
    })
    setStudentsWithAllDocs(allDocsCount)
    setStudentsWithAllDocsToday(allDocsTodayCount)
    // CEP
    const { data: cep } = await supabase.from('cep_submissions').select('student_uid, submitted_at')
    const cepStudentMap: { [uid: string]: string } = {}
    ; (cep || []).forEach((row: any) => {
      if (!cepStudentMap[row.student_uid] || new Date(row.submitted_at) > new Date(cepStudentMap[row.student_uid])) {
        cepStudentMap[row.student_uid] = row.submitted_at
      }
    })
    setCepUniqueStudents(Object.keys(cepStudentMap).length)
    setCepUniqueStudentsToday(Object.values(cepStudentMap).filter(date => date && date.slice(0, 10) === todayStr).length)
    // CEP last 7 days trend
    const last7: string[] = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return d.toISOString().slice(0, 10)
    })
    const cepByDay: Record<string, number> = {}
    last7.forEach(d => { cepByDay[d] = 0 })
    ; (cep || []).forEach((row: any) => {
      const d = (row.submitted_at || '').slice(0, 10)
      if (d in cepByDay) cepByDay[d] = (cepByDay[d] || 0) + 1
    })
    setCepDaily(last7.map(d => ({ date: d.slice(5), count: cepByDay[d] || 0 })))
    // Attendance
    const { data: att } = await supabase
      .from('co_curricular_attendance')
      .select('id, marked_at')
    setTeacherAttendanceToday((att || []).filter((r: any) => (r.marked_at || '').slice(0, 10) === todayStr).length)
    // Removed last 7 days trend for attendance

    const { data: activitiesForDates } = await supabase
      .from('co_curricular_activities')
      .select('id, activity_name, date')
      .order('date', { ascending: false })
    const options = (activitiesForDates || []).map(a => ({ id: a.id, date: a.date, name: a.activity_name }))
    setActivityOptions(options)
    if (options.length > 0 && !selectedActivityId) {
      setSelectedActivityId(String(options[0].id))
    }

    // Upcoming activities (next 3)
    const { data: activities } = await supabase
      .from('co_curricular_activities')
      .select('id, activity_name, date, assigned_class, cc_points')
      .gte('date', todayStr)
      .order('date', { ascending: true })
      .limit(3)
    setUpcomingActivities(activities || [])

    // Attendance status by selected activity
    const computeCountsForActivity = async (activityId: string) => {
      const { data: attStatus } = await supabase
        .from('co_curricular_attendance')
        .select('attendance_status')
        .eq('activity_id', activityId)
      const present = (attStatus || []).filter(r => r.attendance_status === 'present').length
      const absent = (attStatus || []).filter(r => r.attendance_status === 'absent').length
      setAttendanceCountsBySelected({ present, absent })
    }
    if (selectedActivityId) {
      await computeCountsForActivity(selectedActivityId)
    } else if (options.length > 0) {
      await computeCountsForActivity(String(options[0].id))
    }
  }

  // Recompute counts when selection changes
  React.useEffect(() => {
    const run = async () => {
      if (!selectedActivityId) return
      const { data: attStatus } = await supabase
        .from('co_curricular_attendance')
        .select('attendance_status')
        .eq('activity_id', selectedActivityId)
      const present = (attStatus || []).filter(r => r.attendance_status === 'present').length
      const absent = (attStatus || []).filter(r => r.attendance_status === 'absent').length
      setAttendanceCountsBySelected({ present, absent })
    }
    run()
    // eslint-disable-next-line
  }, [selectedActivityId])

  // --- REPORT EXPORTS ---

  const exportFieldProjectReport = async () => {
    const selectedClass = prompt('Enter class to generate report for (e.g., FYIT, FYSD, SYIT, SYSD):')?.trim()
    if (!selectedClass) return
    const { data: students = [] } = await supabase.from('students').select('uid, name, class')
    const { data: submissions = [] } = await supabase.from('field_project_submissions').select('id, student_uid, class, document_type, file_url, uploaded_at')
    const { data: approvals = [] } = await supabase.from('field_project_approvals').select('student_uid, class, approval_status, marks_allotted, credits_allotted')
    const groupedSubmissions = (submissions || [])
      .filter((sub: any) => sub.class === selectedClass)
      .reduce((acc: any, sub: any) => {
        const key = `${sub.student_uid}_${sub.class}`
        if (!acc[key]) acc[key] = { student_uid: sub.student_uid, class: sub.class, submissions: [] }
        acc[key].submissions.push(sub)
        return acc
      }, {})
    const reportData = Object.values(groupedSubmissions).map((group: any) => {
      const student = (students || []).find((s: any) => s.uid === group.student_uid)
      const approval = (approvals || []).find((a: any) => a.student_uid === group.student_uid && a.class === group.class)
      return {
        uid: group.student_uid,
        name: student?.name || group.student_uid,
        status: approval?.approval_status || 'Pending',
        marks: approval?.marks_allotted || 0,
        credits: approval?.credits_allotted || 0
      }
    })
    exportFPReport(reportData)
  }

  const exportCEPReportLanding = async () => {
    const selectedClass = prompt('Enter class to generate report for (e.g., FYIT, FYSD, SYIT, SYSD):')?.trim()
    if (!selectedClass) return
    const { data: requirements = [] } = await supabase.from('cep_requirements').select('*')
    const { data: students = [] } = await supabase.from('students').select('uid, name, class')
    const { data: submissions = [] } = await supabase.from('cep_submissions').select('student_uid, hours')
    const req = (requirements || []).find((r: any) => r.assigned_class === selectedClass)
    const creditConfig = req?.credits_config || []
    const studentMap: Record<string, { name: string; hours: number }> = {}
    ; (students || [])
      .filter((s: any) => s.class === selectedClass)
      .forEach((s: any) => {
        const studentSubs = (submissions || []).filter((sub: any) => sub.student_uid === s.uid)
        const hours = studentSubs.reduce((sum: number, sub: any) => sum + sub.hours, 0)
        studentMap[s.uid] = { name: s.name, hours }
      })
    const reportData = Object.entries(studentMap).map(([uid, { name, hours }]) => {
      let credits = 0
      if (creditConfig.length > 0) {
        const sortedConfig = [...creditConfig].sort((a: any, b: any) => b.hours - a.hours)
        for (const condition of sortedConfig) {
          if (hours >= condition.hours) {
            credits = condition.credits
            break
          }
        }
      }
      return {
        uid,
        name,
        hoursCompleted: hours,
        creditsAllocated: credits
      }
    })
    exportCEPReport(reportData)
  }

  const exportAttendanceReportLanding = async () => {
    const selectedClass = prompt('Enter class to generate attendance report for (e.g., FYIT, FYSD, SYIT, SYSD):')?.trim()
    if (!selectedClass) return
    const { data: activities = [] } = await supabase
      .from('co_curricular_activities')
      .select('*')
    const { data: students = [] } = await supabase
      .from('students')
      .select('uid, name, class')
    const { data: attendanceRecords = [] } = await supabase
      .from('co_curricular_attendance')
      .select('activity_id, student_uid, attendance_status')
    const classActivities = (activities || [])
      .filter((a: any) => Array.isArray(a.assigned_class) && a.assigned_class.includes(selectedClass))
      .sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''))
    const classStudents = (students || []).filter((s: any) => s.class === selectedClass)
    const header = ['uid', 'name', ...classActivities.map((a: any) => a.activity_name), 'Total CC Points']
    const rows: any[][] = [header]
    const attendanceKey = (aid: number, uid: string) => `${aid}__${uid}`
    const attendanceMap = new Map<string, 'present' | 'absent'>()
    for (const rec of (attendanceRecords || [])) {
      attendanceMap.set(attendanceKey(rec.activity_id, rec.student_uid), rec.attendance_status)
    }
    for (const student of classStudents) {
      let totalPoints = 0
      const row = [student.uid, student.name]
      for (const activity of classActivities) {
        const status = attendanceMap.get(attendanceKey(activity.id, student.uid))
        if (status === 'present') {
          row.push('Present')
          totalPoints += activity.cc_points || 0
        } else if (status === 'absent') {
          row.push('Absent')
        } else {
          row.push('-')
        }
      }
      row.push(totalPoints)
      rows.push(row)
    }
    exportAttendanceSheet(rows, `${selectedClass} Attendance`, `attendance_${selectedClass}.xlsx`)
  }

  // --- CHART DATA ---
  const fieldProjectPieData = [
    { name: 'Completed', value: studentsWithAllDocs },
    { name: 'Incomplete', value: Math.max(0, (cepUniqueStudents - studentsWithAllDocs)) }
  ]
  // removed unused attendanceBarData
  const COLORS = [colors.success, colors.danger]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 'clamp(20px, 3vw, 28px)', marginBottom: 8, color: colors.text }}>Welcome to CrediLocker</h1>
        <p style={{ color: colors.subtleText, fontSize: 'clamp(13px, 1.8vw, 16px)' }}>Track your academic achievements</p>
      </div>
      <Section title="Dashboard">
        {role === 'student' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <Card>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Field Project</div>
                <div style={{ fontSize: 14, color: colors.subtleText }}>Uploads</div>
              </div>
              <div style={{ fontSize: 12, color: colors.subtleText }}>
                Completion Letter: {fieldCounts['completion_letter'] || 0}<br />
                Outcome Form: {fieldCounts['outcome_form'] || 0}<br />
                Feedback Form: {fieldCounts['feedback_form'] || 0}<br />
                Video: {fieldCounts['video_presentation'] || 0}
              </div>
            </Card>
            <Card>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Co-Curricular</div>
                <div style={{ fontSize: 14, color: colors.subtleText }}>Upcoming Activities</div>
              </div>
              <div style={{ fontSize: 22, color: colors.primary, fontWeight: 700 }}>{upcomingCCCount}</div>
            </Card>
            <Card>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Attendance</div>
                <div style={{ fontSize: 14, color: colors.subtleText }}>Present percentage</div>
              </div>
              {(() => {
                const total = attendanceStats.present + attendanceStats.absent
                const pct = total > 0 ? Math.round((attendanceStats.present / total) * 100) : 0
                return (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: colors.subtleText, marginBottom: 6 }}>
                      <span>{attendanceStats.present} present</span>
                      <span>{total} total</span>
                    </div>
                    <div style={{ backgroundColor: '#e9ecef', borderRadius: 999, height: 10 }}>
                      <div style={{ backgroundColor: colors.success, height: '100%', borderRadius: 999, width: `${pct}%`, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ marginTop: 6, fontWeight: 700, color: colors.text }}>{pct}%</div>
                  </div>
                )
              })()}
            </Card>
            <Card>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>CEP</div>
              {cepRequirement ? (
                <>
                  <div style={{ fontSize: 13, color: colors.subtleText, marginBottom: 6 }}>Required Hours: {cepRequirement.minimum_hours}</div>
                  <div style={{ backgroundColor: '#e9ecef', borderRadius: 8, height: 10, marginBottom: 6 }}>
                    <div style={{ backgroundColor: cepProgress >= 100 ? colors.success : colors.primary, height: '100%', borderRadius: 8, width: `${cepProgress}%`, transition: 'width 0.3s' }}></div>
                  </div>
                  <div style={{ fontSize: 12, color: colors.subtleText }}>Deadline: {new Date(cepRequirement.deadline).toLocaleDateString()}</div>
                </>
              ) : (
                <div style={{ fontSize: 14, color: colors.subtleText }}>No CEP requirement found.</div>
              )}
            </Card>
          </div>
        ) : (
          <>
          {/* Segment 1: Summary Cards */}
          <Card style={{ marginBottom: 32, padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <Card>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Field Project</div>
                  <div style={{ fontSize: 14, color: colors.subtleText }}>Students with all 4 documents</div>
                </div>
                <div style={{ fontSize: 22, color: colors.primary, fontWeight: 700 }}>{studentsWithAllDocs}</div>
                <div style={{ fontSize: 13, color: colors.success, marginTop: 6 }}>
                  New today: {studentsWithAllDocsToday}
                </div>
              </Card>
              <Card>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>CEP</div>
                  <div style={{ fontSize: 14, color: colors.subtleText }}>Students with submissions</div>
                </div>
                <div style={{ fontSize: 22, color: colors.success, fontWeight: 700 }}>{cepUniqueStudents}</div>
                <div style={{ fontSize: 13, color: colors.success, marginTop: 6 }}>
                  New today: {cepUniqueStudentsToday}
                </div>
              </Card>
              <Card>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Attendance</div>
                  <div style={{ fontSize: 14, color: colors.subtleText }}>Marked Today</div>
                </div>
                <div style={{ fontSize: 22, color: colors.primary, fontWeight: 700 }}>{teacherAttendanceToday}</div>
              </Card>
            </div>
          </Card>

          {/* Segment 2: Download Buttons */}
          <Card style={{ marginBottom: 32, padding: 24 }}>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={exportFieldProjectReport} style={{ padding: 'clamp(8px,1.8vw,12px) clamp(12px,2.2vw,18px)', background: colors.primary, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, lineHeight: 1.2, maxWidth: 220 }}>
                Download
                <br />
                Field Project
                <br />
                Report
              </button>
              <button onClick={exportCEPReportLanding} style={{ padding: 'clamp(8px,1.8vw,12px) clamp(12px,2.2vw,18px)', background: colors.success, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, lineHeight: 1.2, maxWidth: 220 }}>
                Download
                <br />
                CEP
                <br />
                Report
              </button>
              <button onClick={exportAttendanceReportLanding} style={{ padding: 'clamp(8px,1.8vw,12px) clamp(12px,2.2vw,18px)', background: colors.primary, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, lineHeight: 1.2, maxWidth: 220 }}>
                Download
                <br />
                Attendance
                <br />
                Report
              </button>
            </div>
          </Card>

          {/* Segment 3: Charts */}
          <Card style={{ padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, alignItems: 'stretch' }}>
              <Card style={{ padding: 12, height: '100%' }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>Field Project Completion</div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={fieldProjectPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60}>
                      {fieldProjectPieData.map((_, index) => (
                        <Cell key={`cell-fp-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 11, color: colors.subtleText, marginTop: 6 }}>Students with all Field Project docs vs incomplete.</div>
              </Card>
              <Card style={{ padding: 12, height: '100%' }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>CEP Submissions (Last 7 days)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={cepDaily}>
                    <defs>
                      <linearGradient id="colorCep" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors.success} stopOpacity={0.4}/>
                        <stop offset="95%" stopColor={colors.success} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke={colors.success} fillOpacity={1} fill="url(#colorCep)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
              <Card style={{ padding: 12, overflow: 'hidden', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Attendance by Activity</div>
                  <select
                    value={selectedActivityId}
                    onChange={async (e) => {
                      const id = e.target.value
                      setSelectedActivityId(id)
                      // compute immediately for snappy UX
                      const { data: attStatus } = await supabase
                        .from('co_curricular_attendance')
                        .select('attendance_status')
                        .eq('activity_id', id)
                      const present = (attStatus || []).filter(r => r.attendance_status === 'present').length
                      const absent = (attStatus || []).filter(r => r.attendance_status === 'absent').length
                      setAttendanceCountsBySelected({ present, absent })
                    }}
                    style={{ padding: 6, border: `1px solid ${colors.border}`, borderRadius: 8, maxWidth: 280, width: '100%', flex: '0 1 280px' }}
                  >
                    {selectedActivityId === '' && (
                      <option value="" disabled>{activityOptions.length ? 'Select an activity' : 'No activities found'}</option>
                    )}
                    {activityOptions.map(opt => (
                      <option key={`${opt.id}-${opt.date}`} value={String(opt.id)}>{new Date(opt.date).toLocaleDateString()} - {opt.name}</option>
                    ))}
                  </select>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[
                    { name: 'Present', value: attendanceCountsBySelected.present },
                    { name: 'Absent', value: attendanceCountsBySelected.absent }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill={colors.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </Card>

          {/* Segment 4: Upcoming Activities */}
          <Card style={{ padding: 24 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16 }}>Upcoming Co-Curricular Activities</div>
            {upcomingActivities.length === 0 ? (
              <div style={{ color: colors.subtleText, fontSize: 14 }}>No upcoming activities.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {upcomingActivities.map((a: any) => (
                  <Card key={a.id} style={{ padding: 14 }}>
                    <div style={{ fontWeight: 600 }}>{a.activity_name}</div>
                    <div style={{ color: colors.subtleText, fontSize: 13 }}>{new Date(a.date).toLocaleDateString()}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: colors.subtleText }}>For {Array.isArray(a.assigned_class) ? a.assigned_class.join(', ') : a.assigned_class}</div>
                    {a.cc_points ? <div style={{ marginTop: 6, fontSize: 12, color: colors.primary }}>CC Points: {a.cc_points}</div> : null}
                  </Card>
                ))}
              </div>
            )}
          </Card>
          </>
        )}
      </Section>
    </div>
  )
}