import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { UserRole, Student } from '../types'
import { Section, Card, Button, colors } from './UI'

interface ManageClassesProps {
  role: UserRole
}

const CLASS_OPTIONS = ['FYIT', 'FYSD', 'SYIT', 'SYSD']

export default function ManageClasses({ role: _role }: ManageClassesProps) {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const [editingUid, setEditingUid] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<Student>>({})
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')

  // Bulk actions state
  const [bulkClass, setBulkClass] = useState('')
  const [bulkNewSemester, setBulkNewSemester] = useState<number | ''>('')

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('students')
      .select('uid, email, phone_number, name, class, semester')
      .order('class', { ascending: true })
      .order('uid', { ascending: true })

    if (!error) setStudents((data || []) as Student[])
    setLoading(false)
  }

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesClass = !classFilter || s.class === classFilter
      const q = search.toLowerCase()
      const matchesSearch = !q ||
        s.uid.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      return matchesClass && matchesSearch
    })
  }, [students, search, classFilter])

  const startEdit = (student: Student) => {
    setEditingUid(student.uid)
    setEditDraft({ ...student })
  }

  const cancelEdit = () => {
    setEditingUid(null)
    setEditDraft({})
  }

  const saveEdit = async () => {
    if (!editingUid) return
    if (editDraft.class && !CLASS_OPTIONS.includes(editDraft.class)) {
      alert('Invalid class. Allowed: ' + CLASS_OPTIONS.join(', '))
      return
    }
    const { error } = await supabase
      .from('students')
      .update({
        email: editDraft.email,
        phone_number: editDraft.phone_number,
        name: editDraft.name,
        class: editDraft.class,
        semester: editDraft.semester,
      })
      .eq('uid', editingUid)

    if (error) {
      alert('Update failed')
      return
    }
    await fetchStudents()
    cancelEdit()
  }

  const handleCsvUpload = async (file: File) => {
    const text = await file.text()
    const rows = text.split(/\r?\n/).filter(Boolean)
    if (rows.length === 0) return
    const header = rows[0].split(',').map(h => h.trim().toLowerCase())
    const required = ['uid','email','name','class']
    for (const r of required) {
      if (!header.includes(r)) {
        alert(`CSV missing required column: ${r}`)
        return
      }
    }
    const idx = (col: string) => header.indexOf(col)

    const toNumber = (v: string) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }

    const upserts: Partial<Student & { semester: number | null }>[] = []
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].split(',')
      if (cols.length === 0) continue
      const uid = (cols[idx('uid')] || '').trim()
      if (!uid) continue
      const cls = (cols[idx('class')] || '').trim()
      if (!CLASS_OPTIONS.includes(cls)) {
        alert(`Row ${i+1}: invalid class '${cls}'. Allowed: ${CLASS_OPTIONS.join(', ')}`)
        return
      }
      upserts.push({
        uid,
        email: (cols[idx('email')] || '').trim(),
        name: (cols[idx('name')] || '').trim(),
        class: cls,
        semester: idx('semester') >= 0 ? toNumber((cols[idx('semester')] || '').trim()) : null,
        phone_number: idx('phone_number') >= 0 ? (cols[idx('phone_number')] || '').trim() : undefined,
      } as any)
    }

    setLoading(true)
    // Upsert by uid
    const { error } = await supabase
      .from('students')
      .upsert(upserts, { onConflict: 'uid' as any })

    setLoading(false)
    if (error) {
      alert('CSV import failed')
      return
    }
    alert('CSV import completed')
    fetchStudents()
  }

  const bulkDeleteByClass = async () => {
    if (!bulkClass) {
      alert('Please select a class')
      return
    }
    const confirmed = confirm(`Delete ALL students in class ${bulkClass}? This cannot be undone.`)
    if (!confirmed) return
    setLoading(true)
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('class', bulkClass)
    setLoading(false)
    if (error) {
      alert('Bulk delete failed')
      return
    }
    await fetchStudents()
    alert(`Deleted all students in ${bulkClass}`)
  }

  const bulkUpdateSemesterByClass = async () => {
    if (!bulkClass) {
      alert('Please select a class')
      return
    }
    if (bulkNewSemester === '' || Number(bulkNewSemester) <= 0) {
      alert('Enter a valid semester number')
      return
    }
    const confirmed = confirm(`Update ALL students in ${bulkClass} to semester ${bulkNewSemester}?`)
    if (!confirmed) return
    setLoading(true)
    const { error } = await supabase
      .from('students')
      .update({ semester: Number(bulkNewSemester) })
      .eq('class', bulkClass)
    setLoading(false)
    if (error) {
      alert('Bulk update failed')
      return
    }
    await fetchStudents()
    alert(`Updated ${bulkClass} to semester ${bulkNewSemester}`)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, margin: 0, color: colors.text }}>Manage Classes</h1>
        <Card style={{ padding: 12 }}>
          <label style={{ fontSize: 14, color: colors.subtleText }}>
            Upload CSV
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleCsvUpload(f)
              }}
              style={{ display: 'block', marginTop: 6 }}
            />
          </label>
        </Card>
      </div>

      <Section title="Bulk Actions">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: colors.subtleText }}>Class</label>
            <select value={bulkClass} onChange={(e) => setBulkClass(e.target.value)} style={{ padding: 6, border: `1px solid ${colors.border}`, borderRadius: 8 }}>
              <option value="">Select Class</option>
              {CLASS_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: colors.subtleText }}>New Semester</label>
            <input type="number" value={bulkNewSemester} onChange={(e) => setBulkNewSemester(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 4" style={{ padding: 6, border: `1px solid ${colors.border}`, borderRadius: 8, width: 100 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={bulkUpdateSemesterByClass} variant="primary">Update Semester</Button>
            <Button onClick={bulkDeleteByClass} variant="danger">Delete All in Class</Button>
          </div>
        </div>
      </Section>

      <Section title="CSV Format">
        <p style={{ margin: '8px 0', fontSize: 14, color: colors.text }}>
          Include a header row with columns: <strong>uid,email,name,class,semester,phone_number</strong>. Valid classes: {CLASS_OPTIONS.join(', ')}. Semester is optional numeric. Example:
        </p>
        <Card style={{ padding: 10, background: '#f8fafc' }}>
          <pre style={{ margin: 0, overflowX: 'auto' }}>
uid,email,name,class,semester,phone_number
24BIT001,alice@example.com,Alice Smith,FYIT,1,9876543210
24BIT002,bob@example.com,Bob Patel,SYSD,4,
          </pre>
        </Card>
      </Section>

      <Section title="Filters">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: colors.subtleText }}>Class Filter</label>
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ padding: 6, border: `1px solid ${colors.border}`, borderRadius: 8 }}>
              <option value="">All</option>
              {CLASS_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <label style={{ display: 'block', fontSize: 12, color: colors.subtleText }}>Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by UID, name, or email" style={{ width: '100%', padding: 6, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <Button variant="secondary" onClick={() => { setSearch(''); setClassFilter('') }}>Clear</Button>
          </div>
        </div>
      </Section>

      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 110px 90px 120px 180px', gap: 8, fontWeight: 600, paddingBottom: 10, borderBottom: `1px solid ${colors.border}` }}>
          <div>UID</div>
          <div>Name</div>
          <div>Email</div>
          <div>Class</div>
          <div>Sem</div>
          <div>Phone</div>
          <div>Actions</div>
        </div>
        {loading && <div style={{ padding: 12 }}>Loading...</div>}
        {!loading && filteredStudents.map(s => (
          <div key={s.uid} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 110px 90px 120px 180px', gap: 8, padding: '10px 0', borderBottom: `1px solid ${colors.border}`, alignItems: 'center' }}>
            <div style={{ fontFamily: 'monospace' }}>{s.uid}</div>
            {editingUid === s.uid ? (
              <>
                <input value={editDraft.name as string || ''} onChange={(e) => setEditDraft(prev => ({ ...prev, name: e.target.value }))} style={{ padding: 6, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
                <input value={editDraft.email as string || ''} onChange={(e) => setEditDraft(prev => ({ ...prev, email: e.target.value }))} style={{ padding: 6, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
                <select value={editDraft.class as string || ''} onChange={(e) => setEditDraft(prev => ({ ...prev, class: e.target.value }))} style={{ padding: 6, border: `1px solid ${colors.border}`, borderRadius: 8 }}>
                  {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" value={editDraft.semester as number || 0} onChange={(e) => setEditDraft(prev => ({ ...prev, semester: Number(e.target.value) }))} style={{ padding: 6, border: `1px solid ${colors.border}`, borderRadius: 8, width: 80 }} />
                <input value={editDraft.phone_number as string || ''} onChange={(e) => setEditDraft(prev => ({ ...prev, phone_number: e.target.value }))} style={{ padding: 6, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button onClick={saveEdit} variant="success">Save</Button>
                  <Button onClick={cancelEdit} variant="secondary">Cancel</Button>
                </div>
              </>
            ) : (
              <>
                <div>{s.name}</div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.email}</div>
                <div>{s.class}</div>
                <div>{s.semester ?? '-'}</div>
                <div>{s.phone_number ?? '-'}</div>
                <div>
                  <Button onClick={() => startEdit(s)} variant="secondary">Edit</Button>
                </div>
              </>
            )}
          </div>
        ))}
        {!loading && filteredStudents.length === 0 && (
          <div style={{ padding: 12 }}>No students found.</div>
        )}
      </Card>
    </div>
  )
}


