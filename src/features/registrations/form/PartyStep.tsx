import { RiParentLine, RiUserLine } from "@remixicon/react"
import { Controller, useFieldArray, useFormContext } from "react-hook-form"

import { ChoiceGroup } from "@/components/ui/choice"
import { Field, Input } from "@/components/ui/input"
import { MandalSelect } from "@/components/MandalSelect"
import { useT } from "@/i18n/context"

import type { RegistrationType } from "../types"
import { useFormOptions } from "./form-options"
import { emptyMember, type RegistrationFormValues } from "./schema"

const TYPE_OPTIONS: {
  value: RegistrationType
  label: string
  description: string
  icon: React.ReactNode
}[] = [
  {
    value: "individual",
    label: "Individual",
    description: "Only you.",
    icon: <RiUserLine />,
  },
  {
    value: "family",
    label: "Family",
    description: "You and your family members.",
    icon: <RiParentLine />,
  },
]

/** Step 1: who is registering, and from which mandal. */
export function PartyStep() {
  const {
    control,
    register,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<RegistrationFormValues>()
  const { replace, append } = useFieldArray({ control, name: "members" })
  const [type, stashed] = watch(["type", "stashedMembers"])
  const { lockedMandal } = useFormOptions()
  const { t } = useT()

  /**
   * Keeps the member list in step with the type. An individual has exactly one
   * person; a family starts with two cards so it is obvious more can be added.
   *
   * Switching a filled-in family to Individual does not delete the others:
   * they are set aside in `stashedMembers` and come back on switching to
   * Family again. A tap on the wrong card costs nothing.
   */
  const onTypeChange = (next: RegistrationType) => {
    setValue("type", next)
    const members = getValues("members")
    if (next === "individual" && members.length > 1) {
      setValue("stashedMembers", members.slice(1))
      replace([members[0]])
    }
    if (next === "family") {
      const kept = getValues("stashedMembers")
      if (kept.length > 0) {
        append(kept)
        setValue("stashedMembers", [])
      } else if (members.length < 2) {
        append(emptyMember())
      }
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label={t("Registering as")} required>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <ChoiceGroup
              name={field.name}
              value={field.value}
              onChange={onTypeChange}
              options={TYPE_OPTIONS.map((option) => ({
                ...option,
                label: t(option.label),
                description: t(option.description),
              }))}
              className="sm:grid-cols-2"
            />
          )}
        />
      </Field>

      {type !== "individual" && (
        <Field
          label={t("Family name")}
          required
          error={errors.groupName?.message}
        >
          <Input
            id="groupName"
            placeholder={t("Patel family")}
            aria-invalid={!!errors.groupName}
            {...register("groupName")}
          />
        </Field>
      )}

      {type === "individual" && stashed.length > 0 && (
        <p className="-mt-2 rounded-md bg-muted px-3 py-2 text-2xs/relaxed text-muted-foreground">
          {stashed.length === 1
            ? t(
                "1 other person is kept aside, not deleted. Switch back to Family to bring them back."
              )
            : t(
                "{n} other people are kept aside, not deleted. Switch back to Family to bring them back.",
                { n: stashed.length }
              )}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {lockedMandal ? (
          // A sanchalak registers people from their own mandal only.
          <Field
            label={t("Satsang mandal")}
            required
            hint={t("You register people from your own mandal.")}
          >
            <Input
              id="mandal"
              value={t(lockedMandal)}
              readOnly
              aria-readonly
              className="bg-muted/50"
            />
          </Field>
        ) : (
          <Field
            label={t("Satsang mandal")}
            required
            error={errors.mandal?.message}
          >
            <Controller
              control={control}
              name="mandal"
              render={({ field }) => (
                <MandalSelect
                  id="mandal"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t("Select mandal")}
                  // Shown in the chosen language; saved in English.
                  translate={t}
                  invalid={!!errors.mandal}
                />
              )}
            />
          </Field>
        )}
      </div>
    </div>
  )
}
