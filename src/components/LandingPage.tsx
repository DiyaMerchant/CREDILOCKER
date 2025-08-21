import React from 'react'
import { UserRole, User, Student } from '../types'
import { getAccessiblePages } from '../lib/pageAccess'
import { supabase } from '../lib/supabase'
import { Card, Section, colors } from './UI'

interface LandingPageProps {
  role: UserRole
  onPageChange: (page: string) => void
  user?: User
}

export default function LandingPage({ role, onPageChange, user }: LandingPageProps) {
  const [cepProgress, setCepProgress] = React.useState(0)
  const [cepRequirement, setCepRequirement] = React.useState<any>(null)
  const [fieldCounts, setFieldCounts] = React.useState<{[k: string]: number}>({})
  const [deadlines, setDeadlines] = React.useState<{ cep?: string } | null>(null)
  const [upcomingCCCount, setUpcomingCCCount] = React.useState<number>(0)

  React.useEffect(() => {
    if (!user) return
    if (role === 'student') {
      fetchCEPProgress()
      fetchStudentFieldCounts()
      fetchStudentDeadlines()
      fetchUpcomingCC()
    } else {
      fetchTeacherOverview()
    }
  }, [role, user])

  const fetchCEPProgress = async () => {
    if (!user) return
    
    const studentClass = (user.data as Student).class
    
    // Get requirement
    const { data: reqData } = await supabase
      .from('cep_requirements')
      .select('*')
      .eq('assigned_class', studentClass)
    
    if (reqData && reqData.length > 0) {
      setCepRequirement(reqData[0])
      
      // Get submissions
      const { data: subData } = await supabase
        .from('cep_submissions')
        .select('hours')
        .eq('student_uid', user.id)
      
      const totalHours = subData?.reduce((sum, sub) => sum + sub.hours, 0) || 0
      const progress = Math.min((totalHours / reqData[0].minimum_hours) * 100, 100)
      setCepProgress(progress)
    }
  }

  const fetchStudentFieldCounts = async () => {
    if (!user) return
    const { data } = await supabase
      .from('field_project_submissions')
      .select('document_type')
      .eq('student_uid', user.id)
    const counts: {[k: string]: number} = {}
    ;(data || []).forEach((r: any) => {
      counts[r.document_type] = (counts[r.document_type] || 0) + 1
    })
    setFieldCounts(counts)
  }

  const fetchStudentDeadlines = async () => {
    if (!user) return
    const studentClass = (user.data as Student).class
    const { data } = await supabase.from('cep_requirements').select('deadline').eq('assigned_class', studentClass).order('created_at', { ascending: false })
    if (data && data.length > 0) setDeadlines({ cep: data[0].deadline })
  }

  const fetchUpcomingCC = async () => {
    if (!user) return
    const studentClass = (user.data as Student).class
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('co_curricular_activities')
      .select('id, assigned_class, date')
      .gte('date', today)
      .contains('assigned_class', [studentClass] as any)
    if (!error) {
      setUpcomingCCCount((data || []).length)
    }
  }

  const fetchTeacherOverview = async () => {
    const { data: fp } = await supabase.from('field_project_submissions').select('id')
    const { data: cep } = await supabase.from('cep_submissions').select('id')
    setFieldCounts({ total_fp: fp?.length || 0, total_cep: cep?.length || 0 } as any)
  }

  const features = [
    { id: 'field-project', title: 'Field Project', description: 'Track and manage your field project activities.' },
    { id: 'community-engagement', title: 'Community Engagement', description: 'Participate in community service programs.' },
    { id: 'co-curricular', title: 'Co-Curricular Activities', description: 'Record your co-curricular achievements.' },
    { id: 'manage-classes', title: 'Manage Classes', description: 'Upload, view, and edit students by class.' },
  ]

  const accessiblePageIds = user ? getAccessiblePages(user) : ['landing']
  const availableFeatures = features.filter(feature => accessiblePageIds.includes(feature.id))

  return (
    <>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, marginBottom: 8, color: colors.text }}>Welcome to CrediLocker</h1>
          <p style={{ color: colors.subtleText, fontSize: 16 }}>Track your academic achievements</p>
        </div>

        <Section title="Quick Access">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {availableFeatures.map((feature) => (
              <Card key={feature.id} style={{ cursor: 'pointer' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{feature.title}</div>
                <div style={{ color: colors.subtleText, fontSize: 14, marginBottom: 10 }}>{feature.description}</div>
                <button onClick={() => onPageChange(feature.id)} style={{ background: colors.white, color: colors.primary, border: `1px solid ${colors.primary}`, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Open</button>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="Dashboard">
          {role === 'student' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <Card>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Field Project</div>
                  <div style={{ fontSize: 14, color: colors.subtleText }}>Uploads</div>
                </div>
                <div style={{ fontSize: 12, color: colors.subtleText }}>
                  Completion Letter: {fieldCounts['completion_letter'] || 0}<br/>
                  Outcome Form: {fieldCounts['outcome_form'] || 0}<br/>
                  Feedback Form: {fieldCounts['feedback_form'] || 0}<br/>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <Card>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Field Project</div>
                  <div style={{ fontSize: 14, color: colors.subtleText }}>Total Submissions</div>
                </div>
                <div style={{ fontSize: 22, color: colors.primary, fontWeight: 700 }}>{(fieldCounts as any).total_fp || 0}</div>
              </Card>
              <Card>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>CEP</div>
                  <div style={{ fontSize: 14, color: colors.subtleText }}>Total Submissions</div>
                </div>
                <div style={{ fontSize: 22, color: colors.success, fontWeight: 700 }}>{(fieldCounts as any).total_cep || 0}</div>
              </Card>
            </div>
          )}
        </Section>
      </div>
      {/* Removed separate CEP Progress block to include CEP in dashboard cards */}
    </>
  )
}