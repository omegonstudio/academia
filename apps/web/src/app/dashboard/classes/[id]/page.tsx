import Link from 'next/link'
import { ArrowLeft, CalendarDays, ExternalLink, FileText, MapPin, Pencil, UserRound, Users } from 'lucide-react'
import { notFound } from 'next/navigation'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { Badge, Button, Card } from '@/components/ui/primitives'
import { demoClasses } from '@/lib/academy-data'
const labels = { SCHEDULED: 'Programada', IN_PROGRESS: 'En curso', COMPLETED: 'Finalizada', CANCELLED: 'Cancelada' } as const
const tones = { SCHEDULED: 'info', IN_PROGRESS: 'warning', COMPLETED: 'success', CANCELLED: 'danger' } as const
const formatDate = (value: string) => new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(value)).replace('.', '').toUpperCase()
const formatTime = (value: string) => new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const item = demoClasses.find((entry) => entry.id === id); if (!item) notFound()
  return <DashboardShell title="Detalle de clase"><Link href="/dashboard/classes" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Volver a clases</Link><PageHeader eyebrow={`${formatDate(item.startAt)} · ${formatTime(item.startAt)}`} title={item.courseName} description={item.groupName} action={<div className="flex gap-2"><Button variant="outline"><Pencil data-icon="inline-start" />Editar</Button><Button><ExternalLink data-icon="inline-start" />Ir a la clase</Button></div>} /><div className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]"><Card className="p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">Estado de la clase</p><div className="mt-2"><Badge tone={tones[item.status]}>{labels[item.status]}</Badge></div></div><CalendarDays className="size-5 text-primary" /></div><div className="mt-8 grid gap-5 sm:grid-cols-2"><Info icon={CalendarDays} label="Horario" value={`${formatDate(item.startAt)} · ${formatTime(item.startAt)} a ${formatTime(item.endAt)}`} /><Info icon={Users} label="Modalidad" value={`${item.modality} · ${item.durationMinutes} min`} /><Info icon={UserRound} label="Profesor" value={item.teacherName} /><Info icon={MapPin} label="Grupo" value={item.groupName} /></div><div className="mt-8 border-t border-border pt-6"><p className="text-sm font-semibold">Notas</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.notes}</p></div></Card><div className="flex flex-col gap-5"><Card className="p-6"><p className="font-semibold">Asistencia</p><p className="mt-3 text-2xl font-semibold">{item.attendance}</p><p className="mt-1 text-sm text-muted-foreground">Registro visual de la clase demo</p></Card><Card className="p-6"><div className="flex items-center gap-2"><FileText className="size-4 text-primary" /><p className="font-semibold">Materiales</p></div><ul className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">{item.materials.map((material) => <li key={material} className="rounded-lg bg-surface-muted px-3 py-2">{material}</li>)}</ul></Card></div></div></DashboardShell>
}
function Info({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) { return <div className="flex gap-3"><Icon className="mt-0.5 size-4 text-primary" /><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div></div> }

export function generateStaticParams() { return demoClasses.map(({ id }) => ({ id })) }

