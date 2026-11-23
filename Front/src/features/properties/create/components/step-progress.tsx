import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

const steps = [
  'Datos principales',
  'Ubicación y propietario',
  'Características',
  'Fotografías',
  'Revisión',
] as const

interface StepProgressProps {
  currentStep: number
}

export function StepProgress({ currentStep }: StepProgressProps) {
  const mobileProgress = (currentStep / steps.length) * 100

  return (
    <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-brand-900">
            Paso {currentStep} de {steps.length}
          </p>
          <p className="text-right text-xs font-medium text-ink-muted">
            {steps[currentStep - 1]}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Progreso del formulario"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={currentStep}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface"
        >
          <span
            className="block h-full rounded-full bg-brand-700 transition-[width] duration-300"
            style={{ width: `${mobileProgress}%` }}
          />
        </div>
      </div>

      <ol className="hidden sm:flex sm:items-start">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isComplete = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep

          return (
            <li
              key={step}
              className="relative flex flex-1 flex-col items-center text-center"
              aria-current={isCurrent ? 'step' : undefined}
            >
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute right-1/2 top-4 h-px w-full -translate-y-1/2',
                    isComplete || isCurrent
                      ? 'bg-brand-600/35'
                      : 'bg-line',
                  )}
                />
              ) : null}

              <span
                className={cn(
                  'relative z-10 grid size-8 place-items-center rounded-full border text-xs font-bold',
                  isCurrent
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : isComplete
                      ? 'border-brand-600 bg-[#eaf4f8] text-brand-700'
                      : 'border-line bg-white text-ink-muted',
                )}
              >
                {isComplete ? (
                  <Check aria-hidden="true" className="size-4" />
                ) : (
                  stepNumber
                )}
              </span>
              <span
                className={cn(
                  'mt-2 max-w-28 text-xs leading-4',
                  isCurrent
                    ? 'font-semibold text-brand-950'
                    : 'text-ink-muted',
                )}
              >
                {step}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
