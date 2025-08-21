import React, { useEffect, useState } from 'react'
import { UserRole } from '../types'
import { supabase } from '../lib/supabase'

interface CoCurricularProps {
  role: UserRole
}

export default function CoCurricular({ role }: CoCurricularProps) {
  const [activities, setActivities] = useState<any[]>([])
  const [studentClass, setStudentClass] = useState<string | null>(null)
  const [newActivity, setNewActivity] = useState({
    id: null as number | null,
    title: '',
    date: '',
    time: '',
    venue: '',
    classes: [] as string[],
    comments: ''
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
    const { id, title, date, time, venue, classes, comments } = newActivity

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
        comments: ''
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
      comments: activity.comments || ''
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
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px' }}>Co-Curricular Activities</h1>
        {role === 'teacher' && (
          <button
            onClick={() => {
              setNewActivity({
                id: null,
                title: '',
                date: '',
                time: '',
                venue: '',
                classes: [],
                comments: ''
              })
              setShowForm(!showForm)
            }}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            {showForm ? 'Cancel' : 'Add Activity'}
          </button>
        )}
      </div>

      {showForm && role === 'teacher' && (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px', border: '1px solid #ddd', marginBottom: '20px' }}>
          <h3>{newActivity.id ? 'Edit Activity' : 'Add New Activity'}</h3>
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
            <button
              type="submit"
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              {newActivity.id ? 'Update Activity' : 'Add Activity'}
            </button>
          </form>
        </div>
      )}

      <div>
        {activities.length === 0 && <p>No activities available.</p>}
        {activities.map((activity) => (
          <div key={activity.id} style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '5px',
            border: '1px solid #ddd',
            marginBottom: '15px'
          }}>
            <h3 style={{ marginBottom: '5px' }}>{activity.activity_name}</h3>
            <p><strong>Date:</strong> {activity.date}</p>
            <p><strong>Time:</strong> {activity.time}</p>
            <p><strong>Venue:</strong> {activity.venue}</p>
            <p><strong>Classes:</strong> {activity.assigned_class?.join(', ')}</p>
            {activity.comments && <p><strong>Comments:</strong> {activity.comments}</p>}
            {role === 'teacher' && (
              <div style={{ marginTop: '10px' }}>
                <button
                  onClick={() => handleEdit(activity)}
                  style={{
                    marginRight: '10px',
                    backgroundColor: '#ffc107',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    color: '#000'
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(activity.id)}
                  style={{
                    backgroundColor: '#dc3545',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    color: '#fff'
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
