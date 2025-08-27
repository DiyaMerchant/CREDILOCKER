import React, { useState, useEffect } from 'react'
import { UserRole } from '../types'
import { supabase } from '../lib/supabase'
import { exportCEPReport, CEPReportRow } from '../lib/excelExport'
import { Section, Card, Button, Modal, colors } from './UI'

interface CommunityEngagementProps {
  role: UserRole
}

interface CEPRequirement {
  id: string
  assigned_class: string
  minimum_hours: number
  deadline: string
  credits_config: Array<{ hours: number; credits: number }>
}

interface CEPSubmission {
  id: string
  student_uid: string
  class: string
  activity_name: string
  hours: number
  activity_date: string
  location: string
  certificate_url: string
  picture_url: string
  submitted_at: string
}

interface CEPApproval {
  id: string
  student_uid: string
  class: string
  approval_status: string
  credits_allotted: number
  evaluated_by: string
  evaluated_at: string
  evaluation_notes: string
}

export default function CommunityEngagement({ role }: CommunityEngagementProps) {
  const [requirements, setRequirements] = useState<CEPRequirement[]>([])
  const [submissions, setSubmissions] = useState<CEPSubmission[]>([])
  const [approvals, setApprovals] = useState<CEPApproval[]>([])
  const [showForm, setShowForm] = useState(false)
  const [newRequirement, setNewRequirement] = useState({
    assigned_class: '',
    minimum_hours: 0,
    deadline: '',
    credits_config: [] as Array<{ hours: number; credits: number }>
  })
  const [editingRequirementId, setEditingRequirementId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [newSubmission, setNewSubmission] = useState({
    activity_name: '',
    hours: 0,
    activity_date: '',
    location: '',
    certificate_file: null as File | null,
    picture_file: null as File | null
  })
  const [students, setStudents] = useState<{ uid: string; name: string; class: string }[]>([])
  const [filters, setFilters] = useState({
    class: '',
    uid: '',
    name: ''
  })

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  const [evaluationModal, setEvaluationModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<{ uid: string; name: string; class: string } | null>(null)
  const [evaluationData, setEvaluationData] = useState({
    approval_status: 'pending',
    credits_allotted: 0,
    evaluation_notes: ''
  })

  const getPublicHref = (rawUrl: string | undefined | null) => (!rawUrl ? '' : rawUrl.trim().replace(/^@+/, ''))

  const extractStoragePathFromPublicUrl = (url: string) => {
    try {
      const clean = getPublicHref(url)
      const u = new URL(clean)
      const prefix = '/storage/v1/object/public/'
      const idx = u.pathname.indexOf(prefix)
      if (idx === -1) return ''
      const remainder = u.pathname.substring(idx + prefix.length)
      const bucketPrefix = 'student-submissions/'
      if (!remainder.startsWith(bucketPrefix)) return ''
      const path = remainder.substring(bucketPrefix.length)
      return decodeURIComponent(path)
    } catch {
      return ''
    }
  }

  const resolveSignedOrPublic = async (publicUrl: string) => {
    const path = extractStoragePathFromPublicUrl(publicUrl)
    if (!path) return getPublicHref(publicUrl)
    try {
      const { data } = await supabase.storage.from('student-submissions').createSignedUrl(path, 120)
      return data?.signedUrl || getPublicHref(publicUrl)
    } catch {
      return getPublicHref(publicUrl)
    }
  }

  const openPreview = async (title: string, publicUrl: string) => {
    const resolved = await resolveSignedOrPublic(publicUrl)
    setPreviewTitle(title)
    setPreviewUrl(resolved)
    setPreviewOpen(true)
  }

  useEffect(() => {
    fetchRequirements()
    if (role === 'student') {
      fetchStudentSubmissions()
      fetchStudentApproval()
    } else { 
      fetchAllSubmissions()
      fetchStudents()
      fetchAllApprovals()
    }
  }, [role])

  const fetchRequirements = async () => {
    const { data, error } = await supabase
      .from('cep_requirements')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setRequirements(data || [])
  }

  const fetchStudentSubmissions = async () => {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}')
    const { data, error } = await supabase
      .from('cep_submissions')
      .select('*')
      .eq('student_uid', user.id)
      .order('submitted_at', { ascending: false })
    if (!error) setSubmissions(data || [])
  }

  const fetchStudentApproval = async () => {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}')
    const { data, error } = await supabase
      .from('cep_approvals')
      .select('*')
      .eq('student_uid', user.id)
      .single()
    if (!error && data) {
      setApprovals([data])
    }
  }

  const fetchAllSubmissions = async () => {
    const { data, error } = await supabase
      .from('cep_submissions')
      .select('*')
      .order('submitted_at', { ascending: false })
    if (!error) setSubmissions(data || [])
  }

  const fetchAllApprovals = async () => {
    const { data, error } = await supabase
      .from('cep_approvals')
      .select('*')
      .order('evaluated_at', { ascending: false })
    if (!error) setApprovals(data || [])
  }

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('uid, name, class')
      .order('class', { ascending: true })
    if (!error) {
      // Sort by class first, then by last 2 digits of UID
      const sortedStudents = (data || []).sort((a, b) => {
        if (a.class !== b.class) {
          return a.class.localeCompare(b.class)
        }
        // Extract last 2 digits from UID and sort numerically
        const aLastDigits = parseInt(a.uid.slice(-2)) || 0
        const bLastDigits = parseInt(b.uid.slice(-2)) || 0
        return aLastDigits - bLastDigits
      })
      setStudents(sortedStudents)
    }
  }

  const handleAddRequirement = async (e: React.FormEvent) => {
    e.preventDefault()
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}')
    let error
    if (editingRequirementId) {
      const res = await supabase
        .from('cep_requirements')
        .update({ 
          teacher_employee_code: user.id, 
          ...newRequirement,
          credits_config: newRequirement.credits_config
        })
        .eq('id', editingRequirementId)
      error = res.error as any
    } else {
      const res = await supabase
        .from('cep_requirements')
        .insert([{ 
          teacher_employee_code: user.id, 
          ...newRequirement,
          credits_config: newRequirement.credits_config
        }])
      error = res.error as any
    }
    if (!error) {
      fetchRequirements()
      setNewRequirement({ assigned_class: '', minimum_hours: 0, deadline: '', credits_config: [] })
      setEditingRequirementId(null)
      setShowForm(false)
    }
  }

  const handleEditRequirement = (req: CEPRequirement) => {
    setNewRequirement({ 
      assigned_class: req.assigned_class, 
      minimum_hours: req.minimum_hours, 
      deadline: req.deadline,
      credits_config: req.credits_config || []
    })
    setEditingRequirementId(req.id)
    setShowForm(true)
  }

  const handleDeleteRequirement = async (id: string) => {
    if (!confirm('Delete this requirement?')) return
    const { error } = await supabase.from('cep_requirements').delete().eq('id', id)
    if (!error) fetchRequirements()
  }

  const addCreditsCondition = () => {
    setNewRequirement(prev => ({
      ...prev,
      credits_config: [...prev.credits_config, { hours: 0, credits: 0 }]
    }))
  }

  const removeCreditsCondition = (index: number) => {
    setNewRequirement(prev => ({
      ...prev,
      credits_config: prev.credits_config.filter((_, i) => i !== index)
    }))
  }

  const updateCreditsCondition = (index: number, field: 'hours' | 'credits', value: number) => {
    setNewRequirement(prev => ({
      ...prev,
      credits_config: prev.credits_config.map((condition, i) => 
        i === index ? { ...condition, [field]: value } : condition
      )
    }))
  }

  const handleSubmitActivity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubmission.certificate_file || !newSubmission.picture_file) return
    setUploading(true)
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}')
    try {
      const certPath = `cep/certificates/${user.id}_${Date.now()}_${newSubmission.certificate_file.name}`
      const { error: certError } = await supabase.storage.from('student-submissions').upload(certPath, newSubmission.certificate_file)
      if (certError) throw certError
      const picPath = `cep/pictures/${user.id}_${Date.now()}_${newSubmission.picture_file.name}`
      const { error: picError } = await supabase.storage.from('student-submissions').upload(picPath, newSubmission.picture_file)
      if (picError) throw picError
      const { data: { publicUrl: certUrl } } = supabase.storage.from('student-submissions').getPublicUrl(certPath)
      const { data: { publicUrl: picUrl } } = supabase.storage.from('student-submissions').getPublicUrl(picPath)
      let geolocation = ''
      if (navigator.geolocation) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => { geolocation = `${position.coords.latitude},${position.coords.longitude}`; resolve(null) },
            () => resolve(null)
          )
        })
      }
      const { error } = await supabase
        .from('cep_submissions')
        .insert([{ student_uid: user.id, activity_name: newSubmission.activity_name, hours: newSubmission.hours, activity_date: newSubmission.activity_date, location: newSubmission.location, certificate_url: certUrl, picture_url: picUrl, geolocation }])
      if (!error) {
        fetchStudentSubmissions()
        setNewSubmission({ activity_name: '', hours: 0, activity_date: '', location: '', certificate_file: null, picture_file: null })
        alert('Activity submitted successfully!')
      }
    } catch {
      alert('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteSubmission = async (submissionId: string) => {
    if (!confirm('Delete this activity submission?')) return
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}')
    try {
      const { error } = await supabase
        .from('cep_submissions')
        .delete()
        .match({ id: submissionId, student_uid: user.id })
      if (!error) {
        await fetchStudentSubmissions()
      }
    } catch {}
  }

  const handleEvaluateStudent = async () => {
    if (!selectedStudent) return
    
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}')
    try {
      console.log('Evaluating CEP student:', selectedStudent.uid, selectedStudent.class)
      
      // Calculate credits based on hours completed
      const studentSubmissions = submissions.filter(s => s.student_uid === selectedStudent.uid)
      const totalHours = studentSubmissions.reduce((sum, s) => sum + s.hours, 0)
      const requirement = requirements.find(r => r.assigned_class === selectedStudent.class)
      
      let calculatedCredits = 0
      if (requirement && requirement.credits_config) {
        // Find the highest credit tier that the student qualifies for
        const sortedConfig = requirement.credits_config.sort((a, b) => b.hours - a.hours)
        for (const condition of sortedConfig) {
          if (totalHours >= condition.hours) {
            calculatedCredits = condition.credits
            break
          }
        }
      }

      // First, try to delete any existing record to avoid conflicts
      const { error: deleteError } = await supabase
        .from('cep_approvals')
        .delete()
        .eq('student_uid', selectedStudent.uid)
        .eq('class', selectedStudent.class)
      
      if (deleteError) {
        console.error('Delete error:', deleteError)
      }

      // Then insert the new record
      const { error: insertError } = await supabase
        .from('cep_approvals')
        .insert([{
          student_uid: selectedStudent.uid,
          class: selectedStudent.class,
          approval_status: evaluationData.approval_status,
          credits_allotted: evaluationData.approval_status === 'approved' ? calculatedCredits : 0,
          evaluated_by: user.id,
          evaluated_at: new Date().toISOString(),
          evaluation_notes: evaluationData.evaluation_notes
        }])
      
      if (insertError) {
        console.error('Insert error:', insertError)
        throw insertError
      }
      
      await fetchAllApprovals()
      setEvaluationModal(false)
      setSelectedStudent(null)
      setEvaluationData({
        approval_status: 'pending',
        credits_allotted: 0,
        evaluation_notes: ''
      })
      alert('Evaluation submitted successfully!')
    } catch (error) {
      console.error('CEP Evaluation error:', error)
      alert('Failed to submit evaluation')
    }
  }

  const openEvaluationModal = (student: { uid: string; name: string; class: string }) => {
    setSelectedStudent(student)
    const existingApproval = approvals.find(a => a.student_uid === student.uid && a.class === student.class)
    setEvaluationData({
      approval_status: existingApproval?.approval_status || 'pending',
      credits_allotted: existingApproval?.credits_allotted || 0,
      evaluation_notes: existingApproval?.evaluation_notes || ''
    })
    setEvaluationModal(true)
  }

// ...existing code...

const generateExcelReport = () => {
  const selectedClass = prompt('Enter class to generate report for (e.g., FYIT, FYSD, SYIT, SYSD):')?.trim()
  if (!selectedClass) return

  // Find requirement for this class
  const req = requirements.find(r => r.assigned_class === selectedClass)
  const creditConfig = req?.credits_config || []

  // Group submissions by student_uid
  const studentMap: Record<string, { name: string; hours: number }> = {}
  students
    .filter(s => s.class === selectedClass)
    .forEach(s => {
      const studentSubs = submissions.filter(sub => sub.student_uid === s.uid)
      const hours = studentSubs.reduce((sum, sub) => sum + sub.hours, 0)
      studentMap[s.uid] = { name: s.name, hours }
    })

  // Calculate credits for each student
  const reportData = Object.entries(studentMap).map(([uid, { name, hours }]) => {
    // Find the highest credit tier that the student qualifies for
    let credits = 0
    if (creditConfig.length > 0) {
      const sortedConfig = [...creditConfig].sort((a, b) => b.hours - a.hours)
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

  // Export with correct columns
  exportCEPReport(reportData)
}

  const getTotalHours = () => submissions.reduce((total, sub) => total + sub.hours, 0)
  const getRequirementForStudent = () => {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}')
    const studentClass = user.data?.class
    return requirements.find(req => req.assigned_class === studentClass)
  }

  const getStudentApproval = (uid: string, studentClass: string) => {
    return approvals.find(a => a.student_uid === uid && a.class === studentClass)
  }

  const filteredTeacherSubmissions = submissions.filter(sub => {
    const student = students.find(s => s.uid === sub.student_uid)
    const matchesClass = !filters.class || (student && student.class === filters.class)
    const matchesUid = !filters.uid || sub.student_uid.toLowerCase().includes(filters.uid.toLowerCase())
    const matchesName = !filters.name || (student && student.name.toLowerCase().includes(filters.name.toLowerCase()))
    return matchesClass && matchesUid && matchesName
  })

  const groupedTeacherSubmissions = filteredTeacherSubmissions.reduce((acc, sub) => {
    const key = sub.student_uid
    if (!acc[key]) acc[key] = []
    acc[key].push(sub)
    return acc
  }, {} as Record<string, CEPSubmission[]>)

  if (role === 'teacher') {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ fontSize: 28, color: colors.text }}>Community Engagement Program</h1>
          <Button variant="success" onClick={generateExcelReport}>Download Excel Report</Button>
        </div>

        <Section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>Requirements</div>
            <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'Set Requirements'}</Button>
          </div>
          {showForm && (
            <div style={{ marginTop: 12 }}>
              <form onSubmit={handleAddRequirement}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div>
                    <label>Class</label>
                    <select value={newRequirement.assigned_class} onChange={(e) => setNewRequirement({ ...newRequirement, assigned_class: e.target.value })} required style={{ padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8 }}>
                      <option value="">Select Class</option>
                      <option value="FYIT">FYIT</option>
                      <option value="FYSD">FYSD</option>
                      <option value="SYIT">SYIT</option>
                      <option value="SYSD">SYSD</option>
                    </select>
                  </div>
                  <div>
                    <label>Minimum Hours</label>
                    <input type="number" value={newRequirement.minimum_hours} onChange={(e) => setNewRequirement({ ...newRequirement, minimum_hours: parseInt(e.target.value) })} required style={{ padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
                  </div>
                  <div>
                    <label>Deadline</label>
                    <input type="date" value={newRequirement.deadline} onChange={(e) => setNewRequirement({ ...newRequirement, deadline: e.target.value })} required style={{ padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
                  </div>
                </div>
                
                <div style={{ marginBottom: 12 }}>
                  <label>Credits Configuration (Flexible Hour-to-Credit Ratios)</label>
                  <div style={{ marginTop: 8 }}>
                    {newRequirement.credits_config.map((condition, index) => (
                      <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <input
                          type="number"
                          placeholder="Hours"
                          value={condition.hours}
                          onChange={(e) => updateCreditsCondition(index, 'hours', parseInt(e.target.value) || 0)}
                          style={{ padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8, width: 100 }}
                        />
                        <span>hours =</span>
                        <input
                          type="number"
                          placeholder="Credits"
                          value={condition.credits}
                          onChange={(e) => updateCreditsCondition(index, 'credits', parseInt(e.target.value) || 0)}
                          style={{ padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8, width: 100 }}
                        />
                        <span>credits</span>
                        <Button variant="danger" onClick={() => removeCreditsCondition(index)} style={{ padding: '4px 8px', fontSize: 12 }}>Remove</Button>
                      </div>
                    ))}
                    <Button variant="secondary" onClick={addCreditsCondition} style={{ marginTop: 8 }}>Add Credit Condition</Button>
                  </div>
                </div>
                
                <Button variant="success" type="submit">{editingRequirementId ? 'Update Requirements' : 'Set Requirements'}</Button>
              </form>
            </div>
          )}

          {/* Current Requirements list */}
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            {requirements.map((req) => (
              <Card key={req.id} style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Class: {req.assigned_class}</div>
                    <div style={{ fontSize: 14, color: colors.subtleText }}>Minimum Hours: {req.minimum_hours} — Deadline: {new Date(req.deadline).toLocaleDateString()}</div>
                    {req.credits_config && req.credits_config.length > 0 && (
                      <div style={{ fontSize: 14, color: colors.subtleText }}>
                        Credits: {req.credits_config.map(c => `${c.hours}h=${c.credits}c`).join(', ')}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="secondary" onClick={() => handleEditRequirement(req)}>Edit</Button>
                    <Button variant="danger" onClick={() => handleDeleteRequirement(req.id)}>Delete</Button>
                  </div>
                </div>
              </Card>
            ))}
            {requirements.length === 0 && (
              <div style={{ color: colors.subtleText, fontSize: 14 }}>No requirements set yet.</div>
            )}
          </div>
        </Section>

        <Section title="Filters">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <label>Class</label>
              <select value={filters.class} onChange={(e) => setFilters(prev => ({ ...prev, class: e.target.value }))} style={{ padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8 }}>
                <option value="">All Classes</option>
                <option value="FYIT">FYIT</option>
                <option value="FYSD">FYSD</option>
                <option value="SYIT">SYIT</option>
                <option value="SYSD">SYSD</option>
              </select>
            </div>
            <div>
              <label>Student UID</label>
              <input type="text" value={filters.uid} onChange={(e) => setFilters(prev => ({ ...prev, uid: e.target.value }))} placeholder="Search by UID" style={{ padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
            </div>
            <div>
              <label>Student Name</label>
              <input type="text" value={filters.name} onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))} placeholder="Search by name" style={{ padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <Button variant="secondary" onClick={() => setFilters({ class: '', uid: '', name: '' })}>Clear Filters</Button>
            </div>
          </div>
        </Section>

        <Section title="Student Submissions">
          {Object.keys(groupedTeacherSubmissions).length === 0 && (
            <p style={{ color: colors.subtleText }}>No submissions match the current filters.</p>
          )}
          {Object.entries(groupedTeacherSubmissions).map(([uid, subs]) => {
            const total = subs.reduce((sum, s) => sum + s.hours, 0)
            const student = students.find(s => s.uid === uid)
            const approval = getStudentApproval(uid, subs[0]?.class || '')
            
            return (
              <Card key={uid} style={{ marginBottom: 12, padding: 20 }}>
                <div style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: 10, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 18 }}>{student?.name || uid} ({uid})</h4>
                    <div style={{ fontSize: 14, color: colors.subtleText }}><strong>Total Hours:</strong> {total}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Button variant="primary" onClick={() => openEvaluationModal({ uid, name: student?.name || uid, class: subs[0]?.class || '' })}>
                      Evaluate Student
                    </Button>
                    {approval && approval.approval_status !== 'pending' && (
                      <div style={{ 
                        padding: '4px 12px', 
                        borderRadius: 4, 
                        fontSize: 12, 
                        fontWeight: 600,
                        backgroundColor: approval.approval_status === 'approved' ? '#d4edda' : '#f8d7da',
                        color: approval.approval_status === 'approved' ? '#155724' : '#721c24'
                      }}>
                        {approval.approval_status.charAt(0).toUpperCase() + approval.approval_status.slice(1)}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  {subs.map((sub) => (
                    <Card key={sub.id} style={{ backgroundColor: colors.bg, padding: 16 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>{sub.activity_name}</div>
                      <div style={{ fontSize: 12, color: colors.subtleText, marginBottom: 6 }}>Date: {new Date(sub.activity_date).toLocaleDateString()} | Hours: {sub.hours}</div>
                      <div style={{ fontSize: 12, color: colors.subtleText, marginBottom: 8 }}>Location: {sub.location}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {getPublicHref(sub.certificate_url) ? (
                          <Button onClick={() => openPreview('Certificate', sub.certificate_url)}>Certificate</Button>
                        ) : (
                          <Button variant="secondary" disabled>Certificate</Button>
                        )}
                        {getPublicHref(sub.picture_url) ? (
                          <Button variant="success" onClick={() => openPreview('Picture', sub.picture_url)}>Picture</Button>
                        ) : (
                          <Button variant="secondary" disabled>Picture</Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
                {approval && approval.approval_status !== 'pending' && (
                  <div style={{ marginTop: 12, padding: 12, backgroundColor: approval.approval_status === 'approved' ? '#d4edda' : '#f8d7da', borderRadius: 4 }}>
                    <div style={{ fontWeight: 600, color: approval.approval_status === 'approved' ? '#155724' : '#721c24' }}>
                      Evaluation: {approval.approval_status.charAt(0).toUpperCase() + approval.approval_status.slice(1)}
                    </div>
                    {approval.credits_allotted > 0 && (
                      <div style={{ fontSize: 14, color: approval.approval_status === 'approved' ? '#155724' : '#721c24', marginTop: 4 }}>
                        Credits Awarded: {approval.credits_allotted}
                      </div>
                    )}
                    {approval.evaluation_notes && (
                      <div style={{ fontSize: 14, color: approval.approval_status === 'approved' ? '#155724' : '#721c24', marginTop: 4 }}>
                        Notes: {approval.evaluation_notes}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </Section>

        {/* Evaluation Modal */}
        <Modal open={evaluationModal} onClose={() => setEvaluationModal(false)} title="Evaluate Student CEP" width={500}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: colors.subtleText }}>Approval Status</label>
              <select
                value={evaluationData.approval_status}
                onChange={(e) => setEvaluationData(prev => ({ ...prev, approval_status: e.target.value }))}
                style={{ width: '100%', padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8 }}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: colors.subtleText }}>Evaluation Notes</label>
              <textarea
                value={evaluationData.evaluation_notes}
                onChange={(e) => setEvaluationData(prev => ({ ...prev, evaluation_notes: e.target.value }))}
                rows={4}
                style={{ width: '100%', padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8, resize: 'vertical' }}
                placeholder="Add evaluation notes..."
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setEvaluationModal(false)}>Cancel</Button>
              <Button variant="success" onClick={handleEvaluateStudent}>Submit Evaluation</Button>
            </div>
          </div>
        </Modal>

        <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title={previewTitle} noScroll>
          {previewUrl.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={previewUrl} alt={previewTitle} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
          ) : previewUrl.match(/\.(mp4|webm|ogg)$/i) ? (
            <video controls style={{ width: '100%', height: 'auto' }} src={previewUrl} />
          ) : (
            <iframe title="preview" src={previewUrl} style={{ width: '100%', height: '70vh', border: 'none' }} />
          )}
        </Modal>
      </div>
    )
  }

  // Student view
  const requirement = getRequirementForStudent()
  const totalHours = getTotalHours()
  const progress = requirement ? Math.min((totalHours / requirement.minimum_hours) * 100, 100) : 0
  const studentApproval = approvals[0]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
      <h1 style={{ fontSize: 28, marginBottom: 20, color: colors.text }}>Community Engagement Program</h1>

      {requirement && (
        <Card style={{ padding: 20 }}>
          <h3>Your Requirements</h3>
          <p><strong>Minimum Hours:</strong> {requirement.minimum_hours}</p>
          <p><strong>Deadline:</strong> {new Date(requirement.deadline).toLocaleDateString()}</p>
          <p><strong>Completed Hours:</strong> {totalHours}</p>
          <div style={{ backgroundColor: '#f0f0f0', borderRadius: 10, height: 10, marginTop: 10 }}>
            <div style={{ backgroundColor: progress >= 100 ? colors.success : colors.primary, height: '100%', borderRadius: 10, width: `${progress}%`, transition: 'width 0.3s' }}></div>
          </div>
          <p style={{ marginTop: 5, fontSize: 14 }}>{progress.toFixed(1)}% Complete</p>
        </Card>
      )}

      {studentApproval && studentApproval.approval_status !== 'pending' && (
        <Card style={{ padding: 20, marginTop: 16, backgroundColor: studentApproval.approval_status === 'approved' ? '#d4edda' : '#f8d7da' }}>
          <div style={{ fontWeight: 600, color: studentApproval.approval_status === 'approved' ? '#155724' : '#721c24' }}>
            Overall Status: {studentApproval.approval_status.charAt(0).toUpperCase() + studentApproval.approval_status.slice(1)}
          </div>
          {studentApproval.credits_allotted > 0 && (
            <div style={{ fontSize: 14, color: studentApproval.approval_status === 'approved' ? '#155724' : '#721c24', marginTop: 4 }}>
              Credits Awarded: {studentApproval.credits_allotted}
            </div>
          )}
          {studentApproval.evaluation_notes && (
            <div style={{ fontSize: 14, color: studentApproval.approval_status === 'approved' ? '#155724' : '#721c24', marginTop: 4 }}>
              Notes: {studentApproval.evaluation_notes}
            </div>
          )}
        </Card>
      )}

      <Card style={{ padding: 20, marginTop: 16 }}>
        <h3>Submit New Activity</h3>
        <form onSubmit={handleSubmitActivity}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label>Activity Name</label>
              <input type="text" value={newSubmission.activity_name} onChange={(e) => setNewSubmission({ ...newSubmission, activity_name: e.target.value })} required style={{ width: '100%', padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
            </div>
            <div>
              <label>Hours</label>
              <input type="number" value={newSubmission.hours} onChange={(e) => setNewSubmission({ ...newSubmission, hours: parseInt(e.target.value) })} required style={{ width: '100%', padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
            </div>
            <div>
              <label>Activity Date</label>
              <input type="date" value={newSubmission.activity_date} onChange={(e) => setNewSubmission({ ...newSubmission, activity_date: e.target.value })} required style={{ width: '100%', padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
            </div>
            <div>
              <label>Location</label>
              <input type="text" value={newSubmission.location} onChange={(e) => setNewSubmission({ ...newSubmission, location: e.target.value })} required style={{ width: '100%', padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label>Certificate</label>
              <input type="file" accept="image/*,.pdf" onChange={(e) => setNewSubmission({ ...newSubmission, certificate_file: e.target.files?.[0] || null })} required style={{ width: '100%', padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
            </div>
            <div>
              <label>Picture Proof</label>
              <input type="file" accept="image/*" onChange={(e) => setNewSubmission({ ...newSubmission, picture_file: e.target.files?.[0] || null })} required style={{ width: '100%', padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
            </div>
          </div>
          <Button variant={uploading ? 'secondary' : 'success'} disabled={uploading} type="submit">
            {uploading ? 'Uploading...' : 'Submit Activity'}
          </Button>
        </form>
      </Card>

      <Section title="Your Submissions" style={{ marginTop: 16 }}>
        {submissions.map(sub => (
          <Card key={sub.id} style={{ padding: 20}}>
            <div style={{ fontWeight: 600 }}>{sub.activity_name}</div>
            <div style={{ fontSize: 12, color: colors.subtleText }}>Hours: {sub.hours} — {new Date(sub.activity_date).toLocaleDateString()}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {getPublicHref(sub.certificate_url) ? (
                <Button onClick={() => openPreview('Certificate', sub.certificate_url)}>View Certificate</Button>
              ) : (
                <Button variant="secondary" disabled>View Certificate</Button>
              )}
              {getPublicHref(sub.picture_url) ? (
                <Button variant="success" onClick={() => openPreview('Picture', sub.picture_url)}>View Picture</Button>
              ) : (
                <Button variant="secondary" disabled>View Picture</Button>
              )}
              <Button variant="danger" onClick={() => handleDeleteSubmission(sub.id)}>Delete</Button>
            </div>
          </Card>
        ))}
      </Section>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title={previewTitle} noScroll>
        {previewUrl.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={previewUrl} alt={previewTitle} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        ) : previewUrl.match(/\.(mp4|webm|ogg)$/i) ? (
          <video controls style={{ width: '100%', height: 'auto' }} src={previewUrl} />
        ) : (
          <iframe title="preview" src={previewUrl} style={{ width: '100%', height: '70vh', border: 'none' }} />
        )}
      </Modal>
    </div>
  )
}