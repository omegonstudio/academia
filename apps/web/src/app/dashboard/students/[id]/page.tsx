'use client'

import Link from 'next/link'
import { use, useState } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft, Edit3 } from 'lucide-react'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { Badge, Button, Card, ConfirmDialog, Field, Input, Select } from '@/components/ui/primitives'
import { demoStudents, fullName } from '@/lib/academy-data'

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const student = demoStudents.find((item) => item.id === id) ?? demoStudents[0]
  if (!student) notFound()
  const [editing, setEditing] = useState(false)
  const [active, setActive] = useState(student.isActive)
  return <DashboardShell title="Detalle de estudiante"><Link href="/dashboard/students" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Volver a estudiantes</Link><PageHeader eyebrow="Perfil" title={fullName(student)} description={student.email} action={<div className="flex gap-2"><Button variant="outline" onClick={() => setEditing(!editing)}><Edit3 />{editing ? 'Cancelar' : 'Editar'}</Button>{active && <Button variant="danger" onClick={() => setActive(false)}>Desactivar</Button>}</div>} /><div className="grid gap-5 lg:grid-cols-2"><Card className="p-6"><h2 className="font-semibold">Información personal</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><Info label="Nombre" value={student.firstName} /><Info label="Apellido" value={student.lastName} /><Info label="Email" value={student.email} /></div></Card><Card className="p-6"><h2 className="font-semibold">Información académica</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Nivel</p><div className="mt-2"><Badge tone="info">{student.level}</Badge></div></div><div><p className="text-xs text-muted-foreground">Estado</p><div className="mt-2"><Badge tone={active ? 'success' : 'neutral'}>{active ? 'Activo' : 'Inactivo'}</Badge></div></div><Info label="Profesor asignado" value={student.teacher?.name ?? 'Sin asignar'} /></div></Card></div>{editing && <Card className="mt-5 p-6"><h2 className="font-semibold">Editar estudiante</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Nombre" htmlFor="edit-first"><Input id="edit-first" defaultValue={student.firstName} /></Field><Field label="Apellido" htmlFor="edit-last"><Input id="edit-last" defaultValue={student.lastName} /></Field><Field label="Email" htmlFor="edit-email"><Input id="edit-email" defaultValue={student.email} type="email" /></Field><Field label="Nivel" htmlFor="edit-level"><Select id="edit-level" defaultValue={student.level}>{['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => <option key={level}>{level}</option>)}</Select></Field></div><Button className="mt-5" onClick={() => setEditing(false)}>Guardar cambios</Button></Card>}{!active && <ConfirmDialog title="¿Querés desactivar este estudiante?" description="El estudiante dejará de estar activo en la academia." confirmLabel="Desactivar" onConfirm={() => setActive(false)} onClose={() => setActive(true)} />}</DashboardShell>
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-sm font-medium">{value}</p></div> }
