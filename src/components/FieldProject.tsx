import React, { useState, useEffect } from 'react'
import { UserRole } from '../types'
import { supabase } from '../lib/supabase'
import { Section, Card, Button, Modal, colors } from './UI'

interface FieldProjectProps {
  role: UserRole
  studentUid?: string
  studentClass?: string
}

interface Submission {
  id: string
  student_uid: string
  class: string
  document_type: string
  file_url: string
  uploaded_at: string
}

interface StudentData {
  uid: string
  name: string
  class: string
}

export default function FieldProject({ role, studentUid = '', studentClass = '' }: FieldProjectProps) {
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [students, setStudents] = useState<StudentData[]>([])
  const [filters, setFilters] = useState({
    class: '',
    uid: '',
    name: ''
  })

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')

  const documentTypes = [
    { label: 'Completion Letter', type: 'completion_letter', accept: '.pdf,image/*' },
    { label: 'Outcome Form', type: 'outcome_form', accept: '.pdf,image/*' },
    { label: 'Feedback Form', type: 'feedback_form', accept: '.pdf,image/*' },
    { label: 'Final Video Demonstration', type: 'video_presentation', accept: 'video/*' },
  ]

  const typeToLabel = Object.fromEntries(documentTypes.map(({ type, label }) => [type, label]))

  const getPublicHref = (rawUrl: string | undefined | null) => {
    if (!rawUrl) return ''
    return rawUrl.trim().replace(/^@+/, '')
  }

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
      const { data } = await supabase.storage
        .from('student-submissions')
        .createSignedUrl(path, 120)
      return data?.signedUrl || getPublicHref(publicUrl)
    } catch {
      return getPublicHref(publicUrl)
    }
  }

  useEffect(() => {
    if (role === 'student' && studentUid) {
      fetchStudentSubmissions()
    } else if (role === 'teacher') {
      fetchAllSubmissions()
      fetchStudents()
    }
  }, [role, studentUid])

  const fetchStudentSubmissions = async () => {
    if (!studentUid) return

    const { data, error } = await supabase
      .from('field_project_submissions')
      .select('*')
      .eq('student_uid', studentUid)
      .order('uploaded_at', { ascending: false })

    if (!error) setSubmissions(data || [])
  }

  const fetchAllSubmissions = async () => {
    const { data, error } = await supabase
      .from('field_project_submissions')
      .select('*')
      .order('uploaded_at', { ascending: false })

    if (!error) setSubmissions(data || [])
  }

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('uid, name, class')
      .order('class', { ascending: true })

    if (!error) setStudents(data || [])
  }

  const handleFileUpload = async (file: File, type: string) => {
    if (role !== 'student' || !studentUid) {
      alert('Upload only available for students')
      return
    }

    setUploading(prev => ({ ...prev, [type]: true }))

    try {
      const filePath = `field_project/${type}/${studentUid}_${Date.now()}_${file.name}`

      const { error: storageError } = await supabase.storage
        .from('student-submissions')
        .upload(filePath, file)

      if (storageError) {
        throw new Error(`Upload failed: ${storageError.message}`)
      }

      const { data: { publicUrl } } = supabase.storage
        .from('student-submissions')
        .getPublicUrl(filePath)

      const { error: insertError } = await supabase
        .from('field_project_submissions')
        .insert([{
          student_uid: studentUid,
          class: studentClass,
          document_type: type,
          file_url: publicUrl,
        }])

      if (insertError) {
        throw new Error(`Failed to save submission: ${insertError.message}`)
      }

      alert(`${typeToLabel[type]} uploaded successfully!`)
      await fetchStudentSubmissions()
    } catch (error) {
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`)
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }))
    }
  }

  const handleDelete = async (submissionId: string, type: string) => {
    const confirmMessage = `Are you sure you want to delete this ${typeToLabel[type]}?`
    if (!confirm(confirmMessage)) return

    try {
      const submission = submissions.find(s => s.id === submissionId)
      const { error } = await supabase
        .from('field_project_submissions')
        .delete()
        .eq('id', submissionId)
      if (error) throw new Error(`Failed to delete submission: ${error.message}`)

      if (submission?.file_url) {
        try {
          const url = new URL(submission.file_url)
          const pathParts = url.pathname.split('/')
          const filePath = pathParts.slice(pathParts.indexOf('field_project')).join('/')
          await supabase.storage.from('student-submissions').remove([filePath])
        } catch {
          // ignore storage cleanup failures
        }
      }

      alert('Submission deleted successfully!')
      if (role === 'student') await fetchStudentSubmissions()
      else await fetchAllSubmissions()
    } catch (error) {
      alert(`Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const getStudentSubmission = (type: string) => submissions.find(sub => sub.document_type === type)

  const getStudentName = (uid: string) => {
    const student = students.find(s => s.uid === uid)
    return student ? student.name : uid
  }

  const filteredSubmissions = submissions.filter(sub => {
    const student = students.find(s => s.uid === sub.student_uid)
    const matchesClass = !filters.class || sub.class === filters.class
    const matchesUid = !filters.uid || sub.student_uid.toLowerCase().includes(filters.uid.toLowerCase())
    const matchesName = !filters.name || (student && student.name.toLowerCase().includes(filters.name.toLowerCase()))
    return matchesClass && matchesUid && matchesName
  })

  const groupedSubmissions = filteredSubmissions.reduce((acc, sub) => {
    const key = `${sub.student_uid}_${sub.class}`
    if (!acc[key]) acc[key] = { student_uid: sub.student_uid, class: sub.class, submissions: [] as Submission[] }
    acc[key].submissions.push(sub)
    return acc
  }, {} as Record<string, { student_uid: string; class: string; submissions: Submission[] }>)

  const openPreview = async (title: string, publicUrl: string) => {
    const resolved = await resolveSignedOrPublic(publicUrl)
    setPreviewTitle(title)
    setPreviewUrl(resolved)
    setPreviewOpen(true)
  }

  if (role === 'student') {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
        <h1 style={{ fontSize: 24, marginBottom: 16, color: colors.text }}>Field Project Uploads</h1>

        <Section>
          {documentTypes.map(({ label, type, accept }) => {
            const existingSubmission = getStudentSubmission(type)
            const isUploading = uploading[type]
            return (
              <Card key={type} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 600 }}>{label}</div>
                  {existingSubmission && <div style={{ fontSize: 12, color: colors.subtleText }}>Uploaded on {new Date(existingSubmission.uploaded_at).toLocaleDateString()}</div>}
                </div>
                {existingSubmission ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {getPublicHref(existingSubmission.file_url) ? (
                      <Button onClick={() => openPreview(label, existingSubmission.file_url)}>View</Button>
                    ) : (
                      <Button variant="secondary" disabled>View</Button>
                    )}
                    <Button variant="danger" onClick={() => handleDelete(existingSubmission.id, type)}>Delete</Button>
                  </div>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    <input
                      type="file"
                      accept={accept}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload(file, type)
                      }}
                      disabled={isUploading}
                      style={{ marginBottom: 8 }}
                    />
                    {isUploading && <div style={{ color: colors.warning, fontSize: 12 }}>Uploading...</div>}
                  </div>
                )}
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

  // Teacher view
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16, color: colors.text }}>Field Project Submissions</h1>

      <Section title="Filters">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: colors.subtleText }}>Class</label>
            <select
              value={filters.class}
              onChange={(e) => setFilters(prev => ({ ...prev, class: e.target.value }))}
              style={{ padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8 }}
            >
              <option value="">All Classes</option>
              <option value="FYIT">FYIT</option>
              <option value="FYSD">FYSD</option>
              <option value="SYIT">SYIT</option>
              <option value="SYSD">SYSD</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: colors.subtleText }}>Student UID</label>
            <input
              type="text"
              value={filters.uid}
              onChange={(e) => setFilters(prev => ({ ...prev, uid: e.target.value }))}
              placeholder="Search by UID"
              style={{ padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: colors.subtleText }}>Student Name</label>
            <input
              type="text"
              value={filters.name}
              onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Search by name"
              style={{ padding: 8, border: `1px solid ${colors.border}`, borderRadius: 8 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <Button variant="secondary" onClick={() => setFilters({ class: '', uid: '', name: '' })}>Clear Filters</Button>
          </div>
        </div>
      </Section>

      <div>
        {Object.keys(groupedSubmissions).length === 0 ? (
          <p style={{ textAlign: 'center', color: colors.subtleText, fontSize: 16 }}>
            No submissions found matching the current filters.
          </p>
        ) : (
          Object.values(groupedSubmissions).map(({ student_uid, class: studentClass, submissions: studentSubmissions }) => (
            <Card key={`${student_uid}_${studentClass}`} style={{ marginBottom: 16 }}>
              <div style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: 8, marginBottom: 10 }}>
                <h3 style={{ margin: 0, color: colors.text, fontSize: 18 }}>
                  {getStudentName(student_uid)} ({student_uid})
                </h3>
                <p style={{ margin: '4px 0 0 0', color: colors.subtleText }}>Class: {studentClass}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {studentSubmissions.map((submission) => (
                  <Card key={submission.id} style={{ backgroundColor: colors.bg }}>
                    <div style={{ fontWeight: 600, marginBottom: 6, color: colors.text }}>
                      {typeToLabel[submission.document_type] || submission.document_type}
                    </div>
                    <div style={{ fontSize: 12, color: colors.subtleText, marginBottom: 8 }}>
                      Uploaded: {new Date(submission.uploaded_at).toLocaleString()}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {getPublicHref(submission.file_url) ? (
                        <Button onClick={() => openPreview(typeToLabel[submission.document_type] || submission.document_type, submission.file_url)}>View</Button>
                      ) : (
                        <Button variant="secondary" disabled>View</Button>
                      )}
                      <Button variant="danger" onClick={() => handleDelete(submission.id, submission.document_type)}>Delete</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>

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