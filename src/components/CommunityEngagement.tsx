import React, { useState, useEffect } from 'react'
import { UserRole } from '../types'
import { supabase } from '../lib/supabase'
import { Section, Card, Button, Modal, colors } from './UI'

interface CommunityEngagementProps {
  role: UserRole
}

interface CEPRequirement {
  id: string
  assigned_class: string
  minimum_hours: number
  deadline: string
}

interface CEPSubmission {
  id: string
  student_uid: string
  activity_name: string
  hours: number
  activity_date: string
  location: string
  certificate_url: string
  picture_url: string
  submitted_at: string
}

export default function CommunityEngagement({ role }: CommunityEngagementProps) {
  const [requirements, setRequirements] = useState<CEPRequirement[]>([])
  const [submissions, setSubmissions] = useState<CEPSubmission[]>([])
  const [showForm, setShowForm] = useState(false)
  const [newRequirement, setNewRequirement] = useState({
    assigned_class: '',
    minimum_hours: 0,
    deadline: ''
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
    if (role === 'student') fetchStudentSubmissions()
    else { fetchAllSubmissions(); fetchStudents() }
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

  const fetchAllSubmissions = async () => {
    const { data, error } = await supabase
      .from('cep_submissions')
      .select('*')
      .order('submitted_at', { ascending: false })
    if (!error) setSubmissions(data || [])
  }

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('uid, name, class')
      .order('class', { ascending: true })
    if (!error) setStudents(data || [])
  }

  const handleAddRequirement = async (e: React.FormEvent) => {
    e.preventDefault()
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}')
    let error
    if (editingRequirementId) {
      const res = await supabase
        .from('cep_requirements')
        .update({ teacher_employee_code: user.id, ...newRequirement })
        .eq('id', editingRequirementId)
      error = res.error as any
    } else {
      const res = await supabase
        .from('cep_requirements')
        .insert([{ teacher_employee_code: user.id, ...newRequirement }])
      error = res.error as any
    }
    if (!error) {
      fetchRequirements()
      setNewRequirement({ assigned_class: '', minimum_hours: 0, deadline: '' })
      setEditingRequirementId(null)
      setShowForm(false)
    }
  }

  const handleEditRequirement = (req: CEPRequirement) => {
    setNewRequirement({ assigned_class: req.assigned_class, minimum_hours: req.minimum_hours, deadline: req.deadline })
    setEditingRequirementId(req.id)
    setShowForm(true)
  }

  const handleDeleteRequirement = async (id: string) => {
    if (!confirm('Delete this requirement?')) return
    const { error } = await supabase.from('cep_requirements').delete().eq('id', id)
    if (!error) fetchRequirements()
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

  const getTotalHours = () => submissions.reduce((total, sub) => total + sub.hours, 0)
  const getRequirementForStudent = () => {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}')
    const studentClass = user.data?.class
    return requirements.find(req => req.assigned_class === studentClass)
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
        <h1 style={{ fontSize: 28, marginBottom: 20, color: colors.text }}>Community Engagement Program</h1>

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
            return (
              <Card key={uid} style={{ marginBottom: 12, padding: 20 }}>
                <div style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: 10, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: 18 }}>{students.find(s => s.uid === uid)?.name || uid} ({uid})</h4>
                  <div style={{ fontSize: 14, color: colors.subtleText }}><strong>Total Hours:</strong> {total}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  {subs.map((sub) => (
                    <Card key={sub.id} style={{ backgroundColor: colors.bg, padding: 16 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>{sub.activity_name}</div>
                      <div style={{ fontSize: 12, color: colors.subtleText, marginBottom: 6 }}>Date: {new Date(sub.activity_date).toLocaleDateString()} | Hours: {sub.hours}</div>
                      <div style={{ fontSize: 12, color: colors.subtleText, marginBottom: 8 }}>Location: {sub.location}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
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
              </Card>
            )
          })}
        </Section>

        <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title={previewTitle}>
          {previewUrl.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? (
            <img src={previewUrl} alt={previewTitle} style={{ maxWidth: '100%', height: 'auto' }} />
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

      <Card style={{ padding: 20 }}>
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

      <Section title="Your Submissions">
        {submissions.map(sub => (
          <Card key={sub.id} style={{ padding: 20 }}>
            <div style={{ fontWeight: 600 }}>{sub.activity_name}</div>
            <div style={{ fontSize: 12, color: colors.subtleText }}>Hours: {sub.hours} — {new Date(sub.activity_date).toLocaleDateString()}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
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
            </div>
          </Card>
        ))}
      </Section>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title={previewTitle}>
        {previewUrl.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? (
          <img src={previewUrl} alt={previewTitle} style={{ maxWidth: '100%', height: 'auto' }} />
        ) : previewUrl.match(/\.(mp4|webm|ogg)$/i) ? (
          <video controls style={{ width: '100%', height: 'auto' }} src={previewUrl} />
        ) : (
          <iframe title="preview" src={previewUrl} style={{ width: '100%', height: '70vh', border: 'none' }} />
        )}
      </Modal>
    </div>
  )
}