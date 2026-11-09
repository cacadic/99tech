import type { ChangeEvent, Ref } from "react";
import { cn } from "@/shared/lib/utils";

interface CustomFormFieldProps {
  id: string;
  /** Accessible name; the visible label is rendered by the parent. */
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  invalid?: boolean;
  /** `id` of the element that explains an error. */
  describedBy?: string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Longer numbers get a smaller font so a typical quote is never clipped on a phone. */
const sizeFor = (length: number): string =>
  length <= 7
    ? "text-2xl"
    : length <= 9
      ? "text-xl"
      : length <= 11
        ? "text-lg"
        : length <= 14
          ? "text-base"
          : "text-sm";

/**
 * Amount input. It is a plain text field on purpose: whatever the user types is kept and judged by the domain
 * validator, which shows a message for malformed input instead of silently swallowing keystrokes.
 */
const CustomFormField = ({
  id,
  label,
  value,
  onChange,
  readOnly = false,
  invalid = false,
  describedBy,
  className,
  ref,
}: CustomFormFieldProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange?.(event.target.value);
  };

  return (
    <input
      ref={ref}
      id={id}
      name={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
      maxLength={32}
      placeholder="0"
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      value={value}
      title={value === "" ? undefined : value}
      readOnly={readOnly}
      onChange={handleChange}
      className={cn(
        "min-w-0 flex-1 rounded-md bg-transparent px-1 text-right text-white outline-none placeholder:text-white/40 focus-visible:ring-[3px] focus-visible:ring-blue-base/70 light:text-blue-500 light:placeholder:text-blue-500/40",
        sizeFor(value.length),
        invalid && "text-red-300 light:text-red-600",
        className,
      )}
    />
  );
};

export default CustomFormField;
