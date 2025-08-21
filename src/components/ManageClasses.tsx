import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { UserRole, Student } from '../types'

interface ManageClassesProps {
  role: UserRole
}

const CLASS_OPTIONS = ['FYIT', 'FYSD', 'SYIT', 'SYSD']

export default function ManageClasses({ role }: ManageClassesProps) {
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
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', margin: 0 }}>Manage Classes</h1>
        <div>
          <label style={{ marginRight: '10px', fontSize: '14px' }}>
            Upload CSV
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleCsvUpload(f)
              }}
              style={{ display: 'block', marginTop: '6px' }}
            />
          </label>
        </div>
      </div>

      {/* Bulk Actions */}
      <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '5px', border: '1px solid #ddd', marginBottom: '16px' }}>
        <h3 style={{ marginTop: 0 }}>Bulk Actions</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#555' }}>Class</label>
            <select value={bulkClass} onChange={(e) => setBulkClass(e.target.value)} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}>
              <option value="">Select Class</option>
              {CLASS_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#555' }}>New Semester</label>
            <input type="number" value={bulkNewSemester} onChange={(e) => setBulkNewSemester(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 4" style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px', width: '100px' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={bulkUpdateSemesterByClass} style={{ backgroundColor: '#0d6efd', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Update Semester</button>
            <button onClick={bulkDeleteByClass} style={{ backgroundColor: '#dc3545', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Delete All in Class</button>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '5px', border: '1px solid #ddd', marginBottom: '16px' }}>
        <h3 style={{ marginTop: 0 }}>CSV Format</h3>
        <p style={{ margin: '8px 0', fontSize: '14px' }}>
          Include a header row with columns: <strong>uid,email,name,class,semester,phone_number</strong>.
          Valid classes: {CLASS_OPTIONS.join(', ')}. Semester is optional numeric. Example:
        </p>
        <pre style={{ background: '#f8f9fa', padding: '10px', border: '1px solid #eee', overflowX: 'auto' }}>
uid,email,name,class,semester,phone_number
24BIT001,alice@example.com,Alice Smith,FYIT,1,9876543210
24BIT002,bob@example.com,Bob Patel,SYSD,4,
        </pre>
      </div>

      <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '5px', border: '1px solid #ddd', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#555' }}>Class Filter</label>
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}>
              <option value="">All</option>
              {CLASS_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#555' }}>Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by UID, name, or email" style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button onClick={() => { setSearch(''); setClassFilter('') }} style={{ backgroundColor: '#6c757d', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Clear</button>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '5px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 110px 90px 120px 180px', gap: '8px', fontWeight: 600, padding: '10px', borderBottom: '1px solid #eee' }}>
          <div>UID</div>
          <div>Name</div>
          <div>Email</div>
          <div>Class</div>
          <div>Sem</div>
          <div>Phone</div>
          <div>Actions</div>
        </div>
        {loading && <div style={{ padding: '12px' }}>Loading...</div>}
        {!loading && filteredStudents.map(s => (
          <div key={s.uid} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 110px 90px 120px 180px', gap: '8px', padding: '10px', borderBottom: '1px solid #f1f1f1', alignItems: 'center' }}>
            <div style={{ fontFamily: 'monospace' }}>{s.uid}</div>
            {editingUid === s.uid ? (
              <>
                <input value={editDraft.name as string || ''} onChange={(e) => setEditDraft(prev => ({ ...prev, name: e.target.value }))} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                <input value={editDraft.email as string || ''} onChange={(e) => setEditDraft(prev => ({ ...prev, email: e.target.value }))} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                <select value={editDraft.class as string || ''} onChange={(e) => setEditDraft(prev => ({ ...prev, class: e.target.value }))} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}>
                  {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" value={editDraft.semester as number || 0} onChange={(e) => setEditDraft(prev => ({ ...prev, semester: Number(e.target.value) }))} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px', width: '80px' }} />
                <input value={editDraft.phone_number as string || ''} onChange={(e) => setEditDraft(prev => ({ ...prev, phone_number: e.target.value }))} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                <div>
                  <button onClick={saveEdit} style={{ backgroundColor: '#28a745', color: 'white', padding: '6px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}>Save</button>
                  <button onClick={cancelEdit} style={{ backgroundColor: '#6c757d', color: 'white', padding: '6px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
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
                  <button onClick={() => startEdit(s)} style={{ backgroundColor: '#ffc107', color: '#000', padding: '6px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}>Edit</button>
                </div>
              </>
            )}
          </div>
        ))}
        {!loading && filteredStudents.length === 0 && (
          <div style={{ padding: '12px' }}>No students found.</div>
        )}
      </div>
    </div>
  )
}


