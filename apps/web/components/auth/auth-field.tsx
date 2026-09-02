"use client";

import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import type { ChangeEvent, FocusEvent } from "react";
import { useCallback, useId } from "react";

/**
 * One field, and its objection.
 *
 * The border goes bone on focus and nothing glows. The error appears on blur,
 * under the field it belongs to, in amber — never a toast, and never the whole
 * form's worth of complaints at once on submit. Being told what is wrong with
 * the thing you have just finished typing is help; being told everything that
 * is wrong the moment you press the button is a scolding.
 */

interface AuthFieldProps {
  autoComplete?: string;
  error?: string;
  label: string;
  name: string;
  onBlur: (name: string) => void;
  onChange: (name: string, value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "password";
  value: string;
}

function AuthField({
  autoComplete,
  error,
  label,
  name,
  onBlur,
  onChange,
  placeholder,
  type = "text",
  value,
}: AuthFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onChange(name, event.target.value),
    [name, onChange]
  );

  const handleBlur = useCallback(
    (_event: FocusEvent<HTMLInputElement>) => onBlur(name),
    [name, onBlur]
  );

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>

      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        className={cn(
          "mt-2 h-[52px] w-full rounded-full border bg-panel px-5 text-[15px] text-bone",
          "outline-none transition-colors duration-[180ms] placeholder:text-smoke",
          /* Focus is a border, not a halo. */
          "border-hairline focus:border-bone",
          error && "border-amber"
        )}
        id={id}
        name={name}
        onBlur={handleBlur}
        onChange={handleChange}
        placeholder={placeholder}
        type={type}
        value={value}
      />

      {error ? (
        <p className="mt-2 pl-5 text-[13px] text-amber" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { AuthField };
