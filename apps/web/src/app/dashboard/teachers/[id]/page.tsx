'use client'

import Link from 'next/link'
import { use, useState } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft, Edit3 } from 'lucide-react'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { Badge, Button, Card, Field, Input } from '@/components/ui/primitives'
import { availabilityLabels, demoTeachers, fullName } from '@/lib/academy-data'

export default function TeacherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const teacher = demoTeachers.find((item) => item.id === id) ?? demoTeachers[0]
  if (!teacher) notFound()
  const [editing, setEditing] = useState(false)
  const [active, setActive] = useState(teacher.isActive)
  const tone = teacher.availability === 'AVAILABLE' ? 'success' : teacher.availability === 'LIMITED' ? 'warning' : 'neutral'
  return <DashboardShell title="Detalle de profesor"><Link href="/dashboard/teachers" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Volver a profesores</Link><PageHeader eyebrow="Perfil docente" title={fullName(teacher)} description={teacher.email} action={<div className="flex gap-2"><Button variant="outline" onClick={() => setEditing(!editing)}><Edit3 />{editing ? 'Cancelar' : 'Editar'}</Button>{active && <Button variant="danger" onClick={() => setActive(false)}>Desactivar</Button>}</div>} /><div className="grid gap-5 lg:grid-cols-2"><Card className="p-6"><h2 className="font-semibold">Información</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><Info label="Nombre" value={teacher.firstName} /><Info label="Apellido" value={teacher.lastName} /><Info label="Email" value={teacher.email} /><div><p className="text-xs text-muted-foreground">Estado</p><div className="mt-2"><Badge tone={active ? 'success' : 'neutral'}>{active ? 'Activo' : 'Inactivo'}</Badge></div></div></div></Card><Card className="p-6"><h2 className="font-semibold">Disponibilidad</h2><div className="mt-5"><Badge tone={tone}>{availabilityLabels[teacher.availability]}</Badge><p className="mt-3 text-sm text-muted-foreground">La disponibilidad se mantiene separada del estado activo del perfil.</p></div></Card></div>{editing && <Card className="mt-5 p-6"><h2 className="font-semibold">Editar profesor</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Nombre" htmlFor="teacher-edit-first"><Input id="teacher-edit-first" defaultValue={teacher.firstName} /></Field><Field label="Apellido" htmlFor="teacher-edit-last"><Input id="teacher-edit-last" defaultValue={teacher.lastName} /></Field><Field label="Email" htmlFor="teacher-edit-email"><Input id="teacher-edit-email" defaultValue={teacher.email} type="email" /></Field></div><Button className="mt-5" onClick={() => setEditing(false)}>Guardar cambios</Button></Card>}</DashboardShell>
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-sm font-medium">{value}</p></div> }
