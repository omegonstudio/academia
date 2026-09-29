export type Student = { id: string; firstName: string; lastName: string; email: string; level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'; isActive: boolean; teacher?: { id: string; name: string } }
export type Teacher = { id: string; firstName: string; lastName: string; email: string; availability: 'AVAILABLE' | 'UNAVAILABLE' | 'LIMITED'; isActive: boolean }
export type Assignment = { id: string; studentId: string; studentName: string; studentLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'; teacherId?: string; teacherName?: string; status: 'ASSIGNED' | 'UNASSIGNED'; assignedAt?: string }
export type Course = { id: string; name: string; level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'; description: string; isActive: boolean; studentCount: number }
export type Group = { id: string; name: string; courseId: string; courseName: string; teacherId: string; teacherName: string; studentCount: number; schedule: string; isActive: boolean }

export const demoStudents: Student[] = [
  { id: 'stu-1', firstName: 'Sofía', lastName: 'Martínez', email: 'sofia.martinez@ejemplo.com', level: 'B1', isActive: true, teacher: { id: 'tea-1', name: 'Lucía Fernández' } },
  { id: 'stu-2', firstName: 'Mateo', lastName: 'García', email: 'mateo.garcia@ejemplo.com', level: 'A2', isActive: true },
  { id: 'stu-3', firstName: 'Valentina', lastName: 'Rossi', email: 'valentina.rossi@ejemplo.com', level: 'C1', isActive: false },
]

export const demoTeachers: Teacher[] = [
  { id: 'tea-1', firstName: 'Lucía', lastName: 'Fernández', email: 'lucia.fernandez@academia.com', availability: 'AVAILABLE', isActive: true },
  { id: 'tea-2', firstName: 'Martín', lastName: 'Sosa', email: 'martin.sosa@academia.com', availability: 'LIMITED', isActive: true },
  { id: 'tea-3', firstName: 'Ana', lastName: 'Pereyra', email: 'ana.pereyra@academia.com', availability: 'UNAVAILABLE', isActive: false },
]

export const demoAssignments: Assignment[] = [
  { id: 'asg-1', studentId: 'stu-1', studentName: 'Sofía Martínez', studentLevel: 'B1', teacherId: 'tea-1', teacherName: 'Lucía Fernández', status: 'ASSIGNED', assignedAt: '2024-01-15' },
  { id: 'asg-2', studentId: 'stu-2', studentName: 'Mateo García', studentLevel: 'A2', teacherId: 'tea-2', teacherName: 'Martín Sosa', status: 'ASSIGNED', assignedAt: '2024-01-10' },
  { id: 'asg-3', studentId: 'stu-3', studentName: 'Valentina Rossi', studentLevel: 'C1', status: 'UNASSIGNED' },
]

export const demoCourses: Course[] = [
  { id: 'crs-1', name: 'Español Principiante', level: 'A1', description: 'Introducción al idioma español', isActive: true, studentCount: 12 },
  { id: 'crs-2', name: 'Español Intermedio', level: 'B1', description: 'Conversación y gramática intermedia', isActive: true, studentCount: 8 },
  { id: 'crs-3', name: 'Español Avanzado', level: 'C1', description: 'Nivel avanzado con literatura', isActive: true, studentCount: 5 },
]

export const demoGroups: Group[] = [
  { id: 'grp-1', name: 'Grupo A - Lunes y Miércoles', courseId: 'crs-1', courseName: 'Español Principiante', teacherId: 'tea-1', teacherName: 'Lucía Fernández', studentCount: 6, schedule: 'Lunes y Miércoles 18:00', isActive: true },
  { id: 'grp-2', name: 'Grupo B - Martes y Jueves', courseId: 'crs-1', courseName: 'Español Principiante', teacherId: 'tea-2', teacherName: 'Martín Sosa', studentCount: 6, schedule: 'Martes y Jueves 19:00', isActive: true },
  { id: 'grp-3', name: 'Grupo Intensivo', courseId: 'crs-2', courseName: 'Español Intermedio', teacherId: 'tea-1', teacherName: 'Lucía Fernández', studentCount: 8, schedule: 'Lunes a Viernes 15:00', isActive: true },
]

export type ClassStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type AcademyClass = { id: string; groupId: string; groupName: string; courseId: string; courseName: string; teacherId: string; teacherName: string; startAt: string; endAt: string; durationMinutes: number; modality: 'Individual' | 'Grupal'; meetingUrl: string; isActive: boolean; students: string[]; attendance: string; notes: string; materials: string[]; status: ClassStatus }

export const demoClasses: AcademyClass[] = [
  { id: 'cls-1', groupId: 'grp-1', groupName: 'Grupo A - Lunes y Miércoles', courseId: 'crs-1', courseName: 'Español Principiante', teacherId: 'tea-1', teacherName: 'Lucía Fernández', startAt: '2026-09-24T18:00:00', endAt: '2026-09-24T20:00:00', durationMinutes: 120, modality: 'Grupal', meetingUrl: 'https://meet.example.com/grupo-a', isActive: true, students: ['Sofía Martínez', 'Mateo García'], attendance: '2 de 6 presentes', notes: 'Práctica de conversación y comprensión auditiva.', materials: ['Guía de conversación', 'Audio de práctica'], status: 'SCHEDULED' },
  { id: 'cls-2', groupId: 'grp-3', groupName: 'Grupo Intensivo', courseId: 'crs-2', courseName: 'Español Intermedio', teacherId: 'tea-1', teacherName: 'Lucía Fernández', startAt: '2026-09-23T15:00:00', endAt: '2026-09-23T17:00:00', durationMinutes: 120, modality: 'Grupal', meetingUrl: 'https://meet.example.com/intensivo', isActive: true, students: ['Sofía Martínez'], attendance: '8 de 8 presentes', notes: 'Debate guiado sobre actualidad.', materials: ['Artículo de debate'], status: 'IN_PROGRESS' },
  { id: 'cls-3', groupId: 'grp-2', groupName: 'Grupo B - Martes y Jueves', courseId: 'crs-1', courseName: 'Español Principiante', teacherId: 'tea-2', teacherName: 'Martín Sosa', startAt: '2026-09-22T19:00:00', endAt: '2026-09-22T21:00:00', durationMinutes: 120, modality: 'Grupal', meetingUrl: 'https://meet.example.com/grupo-b', isActive: true, students: ['Mateo García'], attendance: '6 de 6 presentes', notes: 'Repaso de contenidos de la unidad 3.', materials: ['Ficha de repaso'], status: 'COMPLETED' },
  { id: 'cls-4', groupId: 'grp-1', groupName: 'Grupo A - Lunes y Miércoles', courseId: 'crs-1', courseName: 'Español Principiante', teacherId: 'tea-1', teacherName: 'Lucía Fernández', startAt: '2026-09-21T18:00:00', endAt: '2026-09-23T20:00:00', durationMinutes: 120, modality: 'Grupal', meetingUrl: 'https://meet.example.com/grupo-a', isActive: false, students: ['Sofía Martínez'], attendance: '0 de 6 presentes', notes: 'Clase cancelada por feriado.', materials: [], status: 'CANCELLED' },
]

export const availabilityLabels: Record<Teacher['availability'], string> = { AVAILABLE: 'Disponible', UNAVAILABLE: 'No disponible', LIMITED: 'Disponibilidad limitada' }

export function fullName(person: { firstName: string; lastName: string }) { return `${person.firstName} ${person.lastName}` }
