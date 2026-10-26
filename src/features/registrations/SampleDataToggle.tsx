import { RiFlaskLine, RiLoader4Line } from "@remixicon/react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"

import { useSampleData, useToggleSampleData } from "./api"

/**
 * "Show dummy data" / "Remove dummy data": loads or removes the 64 made-up
 * registrations used for demos. Admins only — render it only for them. Real
 * registrations are never touched; removing asks first, since it affects
 * every staff member's screens.
 */
export function SampleDataToggle() {
  const { data } = useSampleData(true)
  const toggle = useToggleSampleData()
  const [confirming, setConfirming] = React.useState(false)

  if (!data) return null
  const loaded = data.count > 0

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        disabled={toggle.isPending}
        onClick={() => (loaded ? setConfirming(true) : toggle.mutate("add"))}
      >
        {toggle.isPending && !confirming ? (
          <RiLoader4Line className="animate-spin" />
        ) : (
          <RiFlaskLine />
        )}
        {loaded ? "Remove dummy data" : "Show dummy data"}
      </Button>
      {toggle.error && !confirming && (
        <span className="basis-full text-2xs/relaxed text-destructive sm:basis-auto">
          {toggle.error.message}
        </span>
      )}

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open)
          toggle.reset()
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader
            title="Remove dummy data?"
            description={`Deletes the ${data.count} made-up registrations (marked “Dummy”) for everyone. Real registrations are not touched.`}
          />
          <DialogBody>
            <p className="text-xs/relaxed text-muted-foreground">
              You can bring them back any time with Show dummy data. Changes
              made to them are not kept.
            </p>
            {toggle.error && (
              <p className="text-2xs/relaxed text-destructive">
                {toggle.error.message}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setConfirming(false)}
            >
              Keep
            </Button>
            <Button
              variant="destructive"
              size="lg"
              disabled={toggle.isPending}
              onClick={() =>
                toggle.mutate("remove", {
                  onSuccess: () => setConfirming(false),
                })
              }
            >
              {toggle.isPending && <RiLoader4Line className="animate-spin" />}
              Remove {data.count}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
