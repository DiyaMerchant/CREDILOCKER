import React, { useEffect, useMemo, useState } from 'react'
import { UserRole } from '../types'
import { supabase } from '../lib/supabase'
import { Section, Card, Button, colors } from './UI'

interface CoCurricularProps {
  role: UserRole
}

export default function CoCurricular({ role }: CoCurricularProps) {
  const [activities, setActivities] = useState<any[]>([])
  const [studentClass, setStudentClass] = useState<string | null>(null)
  const [studentUid, setStudentUid] = useState<string | null>(null)
  const [attendanceByActivity, setAttendanceByActivity] = useState<Record<string, 'present' | 'absent'>>({})
  const [newActivity, setNewActivity] = useState({
    id: null as number | null,
    title: '',
    date: '',
    time: '',
    venue: '',
    classes: [] as string[],
    comments: '',
    cc_points: 0
  })
  const [showForm, setShowForm] = useState(false)
  const classOptions = ['FYIT', 'FYSD', 'SYIT', 'SYSD']

  useEffect(() => {
    const savedUserRaw = localStorage.getItem('currentUser')
    if (savedUserRaw) {
      try {
        const savedUser = JSON.parse(savedUserRaw)
        if (savedUser?.role === 'student') {
          setStudentClass(savedUser.data?.class || null)
          setStudentUid(savedUser.data?.uid || null)
        }
      } catch {}
    }
    fetchActivities()
  }, [])

  const fetchActivities = async () => {
    const { data, error } = await supabase
      .from('co_curricular_activities')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching activities:', error)
    } else {
      // If student, filter by assigned_class
      if (role === 'student' && studentClass) {
        const filtered = (data || []).filter((a: any) => Array.isArray(a.assigned_class) && a.assigned_class.includes(studentClass))
        setActivities(filtered)
      } else {
        setActivities(data || [])
      }
    }
  }

  useEffect(() => {
    const loadAttendance = async () => {
      if (role !== 'student' || !studentUid) return
      const { data, error } = await supabase
        .from('co_curricular_attendance')
        .select('activity_id, attendance_status')
        .eq('student_uid', studentUid)
      if (!error && data) {
        const map: Record<string, 'present' | 'absent'> = {}
        for (const row of data as any[]) {
          if (row.activity_id) map[row.activity_id] = row.attendance_status
        }
        setAttendanceByActivity(map)
      }
    }
    loadAttendance()
  }, [role, studentUid, activities.length])

  const stats = useMemo(() => {
    const now = new Date()
    const today = new Date(now.toDateString())
    const upcoming = activities.filter(a => a.date && new Date(a.date) >= today)
    const past = activities.filter(a => a.date && new Date(a.date) < today)
    const attended = role === 'student' ? activities.filter(a => attendanceByActivity[a.id] === 'present').length : 0
    return { total: activities.length, upcoming: upcoming.length, past: past.length, attended }
  }, [activities, attendanceByActivity, role])

  const handleCheckboxChange = (className: string) => {
    setNewActivity((prev) => ({
      ...prev,
      classes: prev.classes.includes(className)
        ? prev.classes.filter((c) => c !== className)
        : [...prev.classes, className],
    }))
  }

  const handleAddOrUpdateActivity = async (e: React.FormEvent) => {
    e.preventDefault()
    const { id, title, date, time, venue, classes, comments, cc_points } = newActivity

    if (title && date && time && venue && classes.length > 0) {
      if (id) {
        // 🔄 Update
        const { error } = await supabase
          .from('co_curricular_activities')
          .update({
            activity_name: title,
            date,
            time,
            venue,
            assigned_class: classes,
            comments,
            cc_points,
          })
          .eq('id', id)

        if (error) {
          console.error('Update error:', error)
          return
        }
      } else {
        // ➕ Insert
        const { error } = await supabase
          .from('co_curricular_activities')
          .insert([{
            activity_name: title,
            date,
            time,
            venue,
            assigned_class: classes,
            comments,
            cc_points,
          }])

        if (error) {
          console.error('Insert error:', error)
          return
        }
      }

      await fetchActivities()
      setNewActivity({
        id: null,
        title: '',
        date: '',
        time: '',
        venue: '',
        classes: [],
        comments: '',
        cc_points: 0
      })
      setShowForm(false)
    }
  }

  const handleEdit = (activity: any) => {
    setNewActivity({
      id: activity.id,
      title: activity.activity_name,
      date: activity.date,
      time: activity.time,
      venue: activity.venue,
      classes: activity.assigned_class || [],
      comments: activity.comments || '',
      cc_points: activity.cc_points || 0
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    const { error } = await supabase
      .from('co_curricular_activities')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete error:', error)
    } else {
      await fetchActivities()
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, color: colors.text }}>Co-Curricular Activities</h1>
        {role === 'teacher' && (
          <Button
            onClick={() => {
              setNewActivity({
                id: null,
                title: '',
                date: '',
                time: '',
                venue: '',
                classes: [],
                comments: '',
                cc_points: 0
              })
              setShowForm(!showForm)
            }}
          >
            {showForm ? 'Cancel' : 'Add Activity'}
          </Button>
        )}
      </div>

      {/* Overview Stats */}
      <Section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Card><div style={{ color: colors.subtleText, fontSize: 12 }}>Total Activities</div><div style={{ fontSize: 22, fontWeight: 700, color: colors.primary }}>{stats.total}</div></Card>
          <Card><div style={{ color: colors.subtleText, fontSize: 12 }}>Upcoming</div><div style={{ fontSize: 22, fontWeight: 700, color: colors.success }}>{stats.upcoming}</div></Card>
          <Card><div style={{ color: colors.subtleText, fontSize: 12 }}>Past</div><div style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>{stats.past}</div></Card>
          {role === 'student' && (
            <Card><div style={{ color: colors.subtleText, fontSize: 12 }}>Attended</div><div style={{ fontSize: 22, fontWeight: 700, color: colors.primary }}>{stats.attended}</div></Card>
          )}
        </div>
      </Section>

      {showForm && role === 'teacher' && (
        <Section>
          <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, color: colors.text }}>{newActivity.id ? 'Edit Activity' : 'Add New Activity'}</h3>
          <form onSubmit={handleAddOrUpdateActivity}>
            <div style={{ marginBottom: '10px' }}>
              <label>Activity Name</label>
              <input
                type="text"
                value={newActivity.title}
                onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <label>Date</label>
                <input
                  type="date"
                  value={newActivity.date}
                  onChange={(e) => setNewActivity({ ...newActivity, date: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label>Time</label>
                <input
                  type="time"
                  value={newActivity.time}
                  onChange={(e) => setNewActivity({ ...newActivity, time: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }}
                />
              </div>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>Venue</label>
              <input
                type="text"
                value={newActivity.venue}
                onChange={(e) => setNewActivity({ ...newActivity, venue: e.target.value })}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>Class</label>
              <div>
                {classOptions.map((className) => (
                  <label key={className} style={{ marginRight: '15px' }}>
                    <input
                      type="checkbox"
                      checked={newActivity.classes.includes(className)}
                      onChange={() => handleCheckboxChange(className)}
                      style={{ marginRight: '5px' }}
                    />
                    {className}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>Additional Comments</label>
              <textarea
                value={newActivity.comments}
                onChange={(e) => setNewActivity({ ...newActivity, comments: e.target.value })}
                rows={3}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>CC Points</label>
              <input
                type="number"
                min={0}
                value={newActivity.cc_points}
                onChange={(e) => setNewActivity({ ...newActivity, cc_points: parseInt(e.target.value) || 0 })}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }}
              />
            </div>
            <Button type="submit" variant="success">
              {newActivity.id ? 'Update Activity' : 'Add Activity'}
            </Button>
          </form>
        </Section>
      )}

      <Section title={activities.length ? 'Activities' : undefined}>
        {activities.length === 0 && <p style={{ color: colors.subtleText }}>No activities available.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {activities.map((activity) => {
            const status = role === 'student' ? attendanceByActivity[activity.id] : undefined
            return (
              <Card key={activity.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h3 style={{ margin: 0, color: colors.text }}>{activity.activity_name}</h3>
                  {role === 'student' && (
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: status === 'present' ? '#ECFDF5' : status === 'absent' ? '#FEF2F2' : '#F3F4F6', color: status === 'present' ? colors.success : status === 'absent' ? colors.danger : colors.subtleText }}>
                      {status === 'present' ? 'Present' : status === 'absent' ? 'Absent' : 'Not marked'}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 6, color: colors.subtleText, fontSize: 14 }}>{activity.date} • {activity.time} • {activity.venue}</div>
                <div style={{ marginTop: 8, fontSize: 14 }}>
                  <strong>Classes:</strong> {activity.assigned_class?.join(', ')}
                </div>
                {typeof activity.cc_points === 'number' && <div style={{ marginTop: 4, fontSize: 14 }}><strong>CC Points:</strong> {activity.cc_points}</div>}
                {activity.comments && <div style={{ marginTop: 6, fontSize: 14 }}><strong>Comments:</strong> {activity.comments}</div>}
                {role === 'teacher' && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <Button variant="secondary" onClick={() => handleEdit(activity)}>Edit</Button>
                    <Button variant="danger" onClick={() => handleDelete(activity.id)}>Delete</Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </Section>
    </div>
  )
}
