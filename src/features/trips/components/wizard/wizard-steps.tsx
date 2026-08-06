"use client"

import { Controller, type Control, type FieldErrors } from "react-hook-form"

import {
  ACCOMMODATION_PREFERENCES,
  CURRENCIES,
  INTERESTS,
  MAX_TRIP_DAYS,
  TRANSPORT_PREFERENCES,
  TRAVEL_STYLES,
} from "@/lib/trips/trip-domain"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { CreateTripInput } from "@/features/trips/schemas/trip.schemas"
import { OptionToggleGroup } from "@/features/trips/components/wizard/option-toggle-group"
import { WizardField } from "@/features/trips/components/wizard/wizard-field"

interface StepProps {
  control: Control<CreateTripInput>
  errors: FieldErrors<CreateTripInput>
}

/** `YYYY-MM-DD` for today, used as the minimum selectable date. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function DestinationStep({ control, errors }: StepProps) {
  return (
    <div className="space-y-5">
      <WizardField
        label="Destination"
        hint="A city or region — “Tokyo”, “Northern Portugal”."
        error={errors.destination?.message}
      >
        {({ controlId, describedBy }) => (
          <Controller
            control={control}
            name="destination"
            render={({ field }) => (
              <Input
                {...field}
                id={controlId}
                aria-describedby={describedBy}
                aria-invalid={Boolean(errors.destination)}
                autoComplete="off"
                placeholder="Where are you going?"
              />
            )}
          />
        )}
      </WizardField>

      <WizardField
        label="Departing from"
        hint="Optional. Lets us plan the legs in and out."
        error={errors.startingCity?.message}
      >
        {({ controlId, describedBy }) => (
          <Controller
            control={control}
            name="startingCity"
            render={({ field }) => (
              <Input
                {...field}
                value={field.value ?? ""}
                id={controlId}
                aria-describedby={describedBy}
                autoComplete="off"
                placeholder="Your home city"
              />
            )}
          />
        )}
      </WizardField>
    </div>
  )
}

export function DatesStep({ control, errors }: StepProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <WizardField label="Start date" error={errors.startDate?.message}>
          {({ controlId, describedBy }) => (
            <Controller
              control={control}
              name="startDate"
              render={({ field }) => (
                <Input
                  {...field}
                  id={controlId}
                  type="date"
                  min={todayIso()}
                  aria-describedby={describedBy}
                  aria-invalid={Boolean(errors.startDate)}
                />
              )}
            />
          )}
        </WizardField>

        <WizardField label="End date" error={errors.endDate?.message}>
          {({ controlId, describedBy }) => (
            <Controller
              control={control}
              name="endDate"
              render={({ field }) => (
                <Input
                  {...field}
                  id={controlId}
                  type="date"
                  min={todayIso()}
                  aria-describedby={describedBy}
                  aria-invalid={Boolean(errors.endDate)}
                />
              )}
            />
          )}
        </WizardField>
      </div>

      <WizardField
        label="Travellers"
        hint={`Including you. Trips can run up to ${MAX_TRIP_DAYS} days.`}
        error={errors.travelers?.message}
      >
        {({ controlId, describedBy }) => (
          <Controller
            control={control}
            name="travelers"
            render={({ field }) => (
              <Input
                id={controlId}
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                aria-describedby={describedBy}
                aria-invalid={Boolean(errors.travelers)}
                className="sm:max-w-32"
                value={Number.isNaN(field.value) ? "" : field.value}
                onBlur={field.onBlur}
                // Empty parses to NaN, which zod reports as "enter a number"
                // rather than silently coercing to 0.
                onChange={(event) => field.onChange(event.target.valueAsNumber)}
              />
            )}
          />
        )}
      </WizardField>
    </div>
  )
}

export function BudgetStep({ control, errors }: StepProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
        <WizardField
          label="Total budget"
          hint="Optional — leave blank and we'll estimate one."
          error={errors.budget?.message}
        >
          {({ controlId, describedBy }) => (
            <Controller
              control={control}
              name="budget"
              render={({ field }) => (
                <Input
                  id={controlId}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={50}
                  placeholder="e.g. 2000"
                  aria-describedby={describedBy}
                  aria-invalid={Boolean(errors.budget)}
                  value={field.value ?? ""}
                  onBlur={field.onBlur}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value === ""
                        ? null
                        : event.target.valueAsNumber
                    )
                  }
                />
              )}
            />
          )}
        </WizardField>

        <WizardField label="Currency" error={errors.currency?.message}>
          {({ controlId, describedBy }) => (
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select
                  {...field}
                  id={controlId}
                  aria-describedby={describedBy}
                  className="sm:w-44"
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.value} value={currency.value}>
                      {currency.label}
                    </option>
                  ))}
                </Select>
              )}
            />
          )}
        </WizardField>
      </div>

      <WizardField
        label="Travel style"
        hint="Sets the pace — how much we schedule each day."
        error={errors.travelStyle?.message}
        asFieldset
      >
        {({ describedBy }) => (
          <Controller
            control={control}
            name="travelStyle"
            render={({ field }) => (
              <OptionToggleGroup
                options={TRAVEL_STYLES}
                value={field.value}
                onChange={field.onChange}
                describedBy={describedBy}
              />
            )}
          />
        )}
      </WizardField>
    </div>
  )
}

export function PreferencesStep({ control, errors }: StepProps) {
  return (
    <div className="space-y-5">
      <WizardField
        label="Interests"
        hint="Pick any that apply. Skip it and we'll assume a bit of everything."
        error={errors.interests?.message}
        asFieldset
      >
        {({ describedBy }) => (
          <Controller
            control={control}
            name="interests"
            render={({ field }) => (
              <OptionToggleGroup
                multiple
                options={INTERESTS}
                value={field.value}
                onChange={field.onChange}
                describedBy={describedBy}
              />
            )}
          />
        )}
      </WizardField>

      <div className="grid gap-5 sm:grid-cols-2">
        <WizardField
          label="Accommodation"
          error={errors.accommodation?.message}
          asFieldset
        >
          {({ describedBy }) => (
            <Controller
              control={control}
              name="accommodation"
              render={({ field }) => (
                <OptionToggleGroup
                  options={ACCOMMODATION_PREFERENCES}
                  value={field.value}
                  onChange={field.onChange}
                  describedBy={describedBy}
                />
              )}
            />
          )}
        </WizardField>

        <WizardField
          label="Getting around"
          error={errors.transportation?.message}
          asFieldset
        >
          {({ describedBy }) => (
            <Controller
              control={control}
              name="transportation"
              render={({ field }) => (
                <OptionToggleGroup
                  options={TRANSPORT_PREFERENCES}
                  value={field.value}
                  onChange={field.onChange}
                  describedBy={describedBy}
                />
              )}
            />
          )}
        </WizardField>
      </div>

      <WizardField
        label="Anything else"
        hint="Travelling with kids, dietary needs, something you must not miss."
        error={errors.notes?.message}
      >
        {({ controlId, describedBy }) => (
          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <Textarea
                {...field}
                value={field.value ?? ""}
                id={controlId}
                rows={3}
                aria-describedby={describedBy}
                placeholder="Optional"
              />
            )}
          />
        )}
      </WizardField>
    </div>
  )
}
