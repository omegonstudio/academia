import { Check } from 'lucide-react'
import { Card } from '@/components/ui/primitives'
import { MEMBERSHIP_BENEFITS } from '@/lib/membership-plans'

export function MembershipBenefits() {
  return (
    <section aria-labelledby="membership-benefits-heading" className="mt-10">
      <Card className="p-6 sm:p-8">
        <h2
          id="membership-benefits-heading"
          className="text-xl font-semibold tracking-tight"
        >
          Todo incluido en Academia
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Los tres planes incluyen el mismo contenido. La diferencia es el
          período de facturación y el precio equivalente mensual.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {MEMBERSHIP_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex gap-2.5 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="size-3.5" aria-hidden />
              </span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}
