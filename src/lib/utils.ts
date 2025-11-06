import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes with proper precedence
 *
 * Combines clsx for conditional classes and tailwind-merge to handle
 * conflicting Tailwind classes properly (e.g., "px-2 px-4" becomes "px-4")
 *
 * @param inputs - Any number of class values (strings, objects, arrays)
 * @returns Merged class string with proper Tailwind precedence
 *
 * @example
 * ```tsx
 * cn("px-2 py-1", condition && "bg-primary", { "text-white": isActive })
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
