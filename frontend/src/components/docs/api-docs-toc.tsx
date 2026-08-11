import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { SECTIONS, type SectionId } from "@/components/docs/api-docs-shared"

export function DocsToc({
  active,
  onSelect,
}: {
  active: SectionId
  onSelect: (id: SectionId) => void
}) {
  const { t } = useTranslation()
  return (
    <nav className="hidden w-52 shrink-0 overflow-auto border-r border-border px-3 py-4 lg:block">
      <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">
        {t("apiDocs.toc")}
      </p>
      <ul className="space-y-0.5">
        {SECTIONS.map((id) => {
          const on = active === id
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                className={cn(
                  "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                  on
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {t(`apiDocs.nav.${id}`)}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
